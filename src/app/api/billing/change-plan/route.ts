export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin, updateOrgPlan } from '@/lib/stripe'
import { PLAN_CONFIGS, type Plan, type PlanConfig } from '@/types/tenant'
import { verifyTenantAccess } from '@/lib/withTenantAuth'
import { changePlanSchema, validateBody } from '@/lib/billingSchemas'
import { billingLimiter, getRequestIdentifier } from '@/lib/rateLimit'

/**
 * POST /api/billing/change-plan
 *
 * Fluxo REAL de mudança de plano via Stripe:
 *
 * - Trial → qualquer pago: REQUER PaymentModal (criar subscription). Nao usa esta API.
 * - Pago → pago superior (upgrade): aplica imediatamente com proration.
 * - Pago → pago inferior (downgrade): agenda para fim do período.
 * - Pago → trial (cancelar): cancela subscription no fim do período.
 *
 * TODA org com plano pago TEM stripe_subscription_id. Se nao tem, e trial.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rl = billingLimiter.check(getRequestIdentifier(req))
    if (!rl.success) return NextResponse.json({ error: 'Muitas requisicoes. Tente novamente em breve.' }, { status: 429 })

    // Validacao Zod
    const body = await req.json()
    const validation = validateBody(changePlanSchema, body)
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
    const { orgId, newPlan } = validation.data!

    // Verificar que o usuario pertence a esta organizacao
    const tenantAuth = await verifyTenantAccess(req, orgId)
    if (tenantAuth.error) return tenantAuth.error

    const supabase = getSupabaseAdmin()

    // Buscar config dinamica do pricing_configs no DB (fallback para hardcoded)
    const { data: pricingRow } = await supabase.from('pricing_configs').select('*').eq('id', newPlan).single()
    const targetConfig: PlanConfig | undefined = pricingRow
      ? { id: pricingRow.id, name: pricingRow.name, price: pricingRow.price_brl, maxUsers: pricingRow.max_users, maxStores: pricingRow.max_stores, features: pricingRow.features, stripePriceId: pricingRow.stripe_price_id || '' }
      : PLAN_CONFIGS[newPlan as Plan]

    if (!targetConfig) {
      return NextResponse.json({ error: `Plano '${newPlan}' inválido` }, { status: 400 })
    }
    const stripe = getStripe()

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', orgId)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organização não encontrada' }, { status: 404 })
    }

    // Sem subscription = trial. Trial so faz upgrade via PaymentModal.
    if (!org.stripe_subscription_id) {
      return NextResponse.json({
        error: 'Você está no plano Trial. Use o botão "Fazer Upgrade" para escolher um plano pago.',
        requiresPayment: true,
      }, { status: 400 })
    }

    const currentPlan = org.plan as Plan
    const planOrder: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    const currentIdx = planOrder.indexOf(currentPlan)
    const targetIdx = planOrder.indexOf(newPlan as Plan)
    const isUpgrade = targetIdx > currentIdx
    const isCancelToTrial = newPlan === 'trial'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id) as any

    // Calcular data de fim do periodo (fallback 30 dias se Stripe nao retornar)
    const periodEndTs = subscription.current_period_end
    const periodEnd = periodEndTs
      ? new Date(periodEndTs * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // === CANCELAR → TRIAL ===
    if (isCancelToTrial) {
      await stripe.subscriptions.update(org.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
      await supabase.from('organizations').update({
        pending_plan: 'trial',
        previous_plan: currentPlan,
        current_period_end: periodEnd,
        cancel_at_period_end: true,
      }).eq('id', orgId)

      return NextResponse.json({
        success: true,
        pendingPlan: 'trial',
        previousPlan: currentPlan,
        effectiveDate: periodEnd,
        message: `Sua assinatura será cancelada em ${new Date(periodEnd).toLocaleDateString('pt-BR')}. Até lá, você mantém o plano ${currentPlan}.`,
      })
    }

    // Buscar price e item da subscription atual
    const newPriceId = targetConfig.stripePriceId
    if (!newPriceId) {
      return NextResponse.json({ error: `Plano '${newPlan}' não tem preço configurado no Stripe` }, { status: 400 })
    }

    const currentItemId = subscription.items?.data?.[0]?.id
    if (!currentItemId) {
      return NextResponse.json({ error: 'Subscription sem itens — contate o suporte' }, { status: 500 })
    }

    // === UPGRADE (imediato com proration) ===
    if (isUpgrade) {
      const updated = await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
      })

      await updateOrgPlan(orgId, newPlan as string, {
        stripe_subscription_id: updated.id,
        trial_ends_at: null,
        pending_plan: null,
        previous_plan: null,
        cancel_at_period_end: false,
        current_period_end: null,
      })

      return NextResponse.json({
        success: true,
        applied: true,
        message: `Plano atualizado para ${targetConfig.name}! As novas features já estão disponíveis.`,
      })
    }

    // === DOWNGRADE (agenda para fim do período) ===
    await stripe.subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: currentItemId, price: newPriceId }],
      proration_behavior: 'none',
    })

    await supabase.from('organizations').update({
      pending_plan: newPlan,
      previous_plan: currentPlan,
      current_period_end: periodEnd,
    }).eq('id', orgId)

    return NextResponse.json({
      success: true,
      pendingPlan: newPlan,
      previousPlan: currentPlan,
      effectiveDate: periodEnd,
      message: `Downgrade agendado para ${new Date(periodEnd).toLocaleDateString('pt-BR')}. Você mantém o plano ${currentPlan} até lá.`,
    })
  } catch (err) {
    console.error('[ChangePlan] Erro:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro interno ao processar mudança de plano',
    }, { status: 500 })
  }
}
