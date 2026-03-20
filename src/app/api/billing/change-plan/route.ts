import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin, updateOrgPlan } from '@/lib/stripe'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'

/**
 * POST /api/billing/change-plan
 * Muda o plano via Stripe API — sem redirecionar para portal externo.
 *
 * Upgrade: aplica imediatamente com proration.
 * Downgrade: agenda para fim do periodo (cliente mantem plano atual ate la).
 * Cancelar (→ trial): cancela subscription no fim do periodo.
 */
export async function POST(req: NextRequest) {
  try {
    const { orgId, newPlan } = await req.json()
    if (!orgId || !newPlan) {
      return NextResponse.json({ error: 'orgId e newPlan obrigatorios' }, { status: 400 })
    }

    const config = PLAN_CONFIGS[newPlan as Plan]
    if (!config) {
      return NextResponse.json({ error: `Plano '${newPlan}' invalido` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const stripe = getStripe()

    // Buscar org
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', orgId)
      .single()

    if (orgErr || !org) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    const currentPlan = org.plan as Plan
    const planOrder: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    const isUpgrade = planOrder.indexOf(newPlan as Plan) > planOrder.indexOf(currentPlan)
    const isDowngradeToTrial = newPlan === 'trial'

    // Se nao tem subscription (trial puro) e quer upgrade → precisa do PaymentModal (nao esta API)
    if (!org.stripe_subscription_id && !isDowngradeToTrial) {
      return NextResponse.json({
        error: 'Sem assinatura ativa. Use o modal de pagamento para fazer upgrade.',
        requiresPayment: true,
      }, { status: 400 })
    }

    // Se nao tem subscription e ja e trial → nada a fazer
    if (!org.stripe_subscription_id && isDowngradeToTrial) {
      return NextResponse.json({ success: true, message: 'Ja esta no plano trial' })
    }

    const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id!) as unknown as { current_period_end: number; items: { data: Array<{ id: string }> } }

    if (isDowngradeToTrial) {
      // Cancelar subscription no fim do periodo → webhook aplicara trial
      await stripe.subscriptions.update(org.stripe_subscription_id!, {
        cancel_at_period_end: true,
      })

      // Salvar pending state
      await supabase.from('organizations').update({
        pending_plan: 'trial',
        current_period_end: new Date((subscription.current_period_end) * 1000).toISOString(),
        cancel_at_period_end: true,
      }).eq('id', orgId)

      return NextResponse.json({
        success: true,
        pendingPlan: 'trial',
        effectiveDate: new Date((subscription.current_period_end) * 1000).toISOString(),
      })
    }

    // Upgrade ou downgrade entre planos pagos
    const newPriceId = config.stripePriceId
    if (!newPriceId) {
      return NextResponse.json({ error: `Plano '${newPlan}' nao tem priceId configurado` }, { status: 400 })
    }

    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      return NextResponse.json({ error: 'Subscription sem items' }, { status: 500 })
    }

    if (isUpgrade) {
      // Upgrade imediato com proration
      const updated = await stripe.subscriptions.update(org.stripe_subscription_id!, {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: 'create_prorations',
      })

      // Aplicar plano imediatamente
      await updateOrgPlan(orgId, newPlan, {
        stripe_subscription_id: updated.id,
        trial_ends_at: null,
        pending_plan: null,
        cancel_at_period_end: false,
      })

      return NextResponse.json({ success: true, applied: true })
    } else {
      // Downgrade: agendar para fim do periodo
      // Stripe aplica a mudanca no proximo ciclo de billing
      await stripe.subscriptions.update(org.stripe_subscription_id!, {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: 'none', // sem proration — cobra o novo preco so no proximo ciclo
      })

      // Salvar pending state (o plano ja foi trocado no Stripe, mas mostramos aviso)
      const periodEnd = new Date((subscription.current_period_end) * 1000).toISOString()
      await supabase.from('organizations').update({
        pending_plan: newPlan,
        current_period_end: periodEnd,
      }).eq('id', orgId)

      return NextResponse.json({
        success: true,
        pendingPlan: newPlan,
        effectiveDate: periodEnd,
      })
    }
  } catch (err) {
    console.error('[ChangePlan] Erro:', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro interno',
    }, { status: 500 })
  }
}
