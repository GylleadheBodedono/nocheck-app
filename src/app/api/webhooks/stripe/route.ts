// ============================================
// API: Stripe Webhook Handler
// ============================================
// Processa eventos do Stripe para sincronizar o status
// da assinatura com o banco de dados.
//
// Eventos processados:
//   - checkout.session.completed → ativa plano
//   - customer.subscription.updated → atualiza plano
//   - customer.subscription.deleted → downgrade para trial
//   - invoice.payment_failed → notifica admin
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PLAN_CONFIGS } from '@/types/tenant'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

// Mapear price_id → plan name
function getPlanFromPriceId(priceId: string): string | null {
  for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
    if (config.stripePriceId === priceId) return plan
  }
  return null
}

// Buscar features do plano
function getFeaturesForPlan(plan: string): string[] {
  const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]
  return config?.features || PLAN_CONFIGS.trial.features
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // Validar webhook (se tiver secret configurado)
  let event: Stripe.Event
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } else {
      // Sem webhook secret (dev local) — aceitar qualquer payload
      event = JSON.parse(body) as Stripe.Event
      console.log('[Stripe Webhook] AVISO: Sem webhook secret, aceitando payload sem validacao')
    }
  } catch (err) {
    console.error('[Stripe Webhook] Signature invalida:', err)
    return NextResponse.json({ error: 'Signature invalida' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('[Stripe Webhook] Evento:', event.type)

  try {
    switch (event.type) {
      // Checkout concluido → ativar plano
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.toString()
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.toString()

        if (!orgId) { console.error('[Stripe] checkout sem org_id'); break }

        // Buscar subscription para pegar o price_id
        let plan = 'starter'
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items.data[0]?.price?.id
          if (priceId) plan = getPlanFromPriceId(priceId) || 'starter'
        }

        const features = getFeaturesForPlan(plan)
        const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]

        await supabase.from('organizations').update({
          plan,
          features,
          max_users: config?.maxUsers || 5,
          max_stores: config?.maxStores || 3,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          trial_ends_at: null, // Nao e mais trial
        }).eq('id', orgId)

        console.log(`[Stripe] Org ${orgId} → plano ${plan}`)
        break
      }

      // Subscription atualizada (upgrade/downgrade)
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? getPlanFromPriceId(priceId) || 'starter' : 'starter'
        const features = getFeaturesForPlan(plan)
        const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]

        await supabase.from('organizations').update({
          plan,
          features,
          max_users: config?.maxUsers || 5,
          max_stores: config?.maxStores || 3,
        }).eq('id', orgId)

        console.log(`[Stripe] Subscription updated: org ${orgId} → ${plan}`)
        break
      }

      // Subscription cancelada → downgrade para trial
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        const trialFeatures = PLAN_CONFIGS.trial.features

        await supabase.from('organizations').update({
          plan: 'trial',
          features: trialFeatures,
          max_users: PLAN_CONFIGS.trial.maxUsers,
          max_stores: PLAN_CONFIGS.trial.maxStores,
          stripe_subscription_id: null,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 dias trial
        }).eq('id', orgId)

        console.log(`[Stripe] Subscription deleted: org ${orgId} → trial`)
        break
      }

      // Pagamento falhou
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : ''
        console.log(`[Stripe] Payment failed for customer ${customerId}`)
        // TODO: enviar notificacao para o admin da org
        break
      }

      default:
        console.log(`[Stripe Webhook] Evento nao processado: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook] Erro ao processar:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
