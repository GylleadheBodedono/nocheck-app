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

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getStripe, getSupabaseAdmin, getPlanFromPriceId, updateOrgPlan } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // Validar webhook (se tiver secret configurado)
  let event: Stripe.Event
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const stripe = getStripe()
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

  const supabase = getSupabaseAdmin()

  console.log('[Stripe Webhook] Evento:', event.type)

  let hasErrors = false

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

        try {
          await updateOrgPlan(orgId, plan, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            trial_ends_at: null, // Nao e mais trial
          })
        } catch (updateErr) {
          console.error('[Stripe Webhook] DB update failed (checkout.session.completed):', updateErr)
          hasErrors = true
        }

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

        try {
          await updateOrgPlan(orgId, plan)
        } catch (updateErr) {
          console.error('[Stripe Webhook] DB update failed (customer.subscription.updated):', updateErr)
          hasErrors = true
        }

        console.log(`[Stripe] Subscription updated: org ${orgId} → ${plan}`)
        break
      }

      // Subscription cancelada → downgrade para trial
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        try {
          await updateOrgPlan(orgId, 'trial', {
            stripe_subscription_id: null,
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 dias trial
          })
        } catch (updateErr) {
          console.error('[Stripe Webhook] DB update failed (customer.subscription.deleted):', updateErr)
          hasErrors = true
        }

        console.log(`[Stripe] Subscription deleted: org ${orgId} → trial`)
        break
      }

      // Pagamento falhou → notificar admins da org
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : ''
        console.log(`[Stripe] Payment failed for customer ${customerId}`)

        if (customerId) {
          // Buscar org pelo stripe_customer_id
          const { data: failedOrg } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('stripe_customer_id', customerId)
            .single()

          if (failedOrg) {
            // Buscar admins/owners da org para notificar
            const { data: admins } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', failedOrg.id)
              .in('role', ['owner', 'admin'])

            if (admins && admins.length > 0) {
              const notifications = admins.map((a: { user_id: string }) => ({
                user_id: a.user_id,
                title: 'Falha no pagamento',
                message: `O pagamento da assinatura de ${failedOrg.name} falhou. Atualize seu metodo de pagamento para evitar interrupcao do servico.`,
                type: 'payment_failed',
                link: '/admin/configuracoes/billing',
              }))

              const { error: notifErr } = await supabase.from('notifications').insert(notifications)
              if (notifErr) {
                console.error('[Stripe Webhook] DB insert notifications failed:', notifErr)
                hasErrors = true
              } else {
                console.log(`[Stripe] Notificou ${admins.length} admin(s) da org ${failedOrg.id}`)
              }
            }
          }
        }
        break
      }

      default:
        console.log(`[Stripe Webhook] Evento nao processado: ${event.type}`)
    }

    if (hasErrors) {
      console.error('[Stripe Webhook] Evento processado com erros:', event.type)
    }

    // Always return 200 — Stripe expects it even if we had DB errors
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Stripe Webhook] Erro ao processar:', err)
    // Still return 200 to prevent Stripe retries for unrecoverable errors
    return NextResponse.json({ received: true })
  }
}
