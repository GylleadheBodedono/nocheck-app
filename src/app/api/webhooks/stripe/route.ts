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
import { serverLogger } from '@/lib/serverLogger'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  // Validar webhook (se tiver secret configurado)
  let event: Stripe.Event
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const stripe = getStripe()

  if (!webhookSecret) {
    serverLogger.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET nao configurado — rejeitando request')
    return NextResponse.json({ error: 'Webhook secret nao configurado' }, { status: 500 })
  }

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    serverLogger.error('[Stripe Webhook] Signature invalida', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Signature invalida' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  serverLogger.info('[Stripe Webhook] Evento', { detail: `${event.type} ${event.id}` })

  // Idempotencia: verificar se ja processamos este evento
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (existing) {
    serverLogger.info('[Stripe Webhook] Evento ja processado, ignorando', { detail: event.id })
    return NextResponse.json({ received: true, duplicate: true })
  }

  let hasErrors = false

  try {
    switch (event.type) {
      // Checkout concluido → ativar plano
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.toString()
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.toString()

        if (!orgId) { serverLogger.error('[Stripe] checkout sem org_id'); break }

        // Buscar subscription para pegar o price_id
        let plan = 'starter'
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = sub.items.data[0]?.price?.id
          if (priceId) plan = (await getPlanFromPriceId(priceId)) || 'starter'
        }

        try {
          await updateOrgPlan(orgId, plan, {
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            trial_ends_at: null, // Nao e mais trial
          })
        } catch (updateErr) {
          serverLogger.error('[Stripe Webhook] DB update failed (checkout.session.completed)', { error: updateErr instanceof Error ? updateErr.message : String(updateErr) })
          hasErrors = true
        }

        serverLogger.info(`[Stripe] Org ${orgId} → plano ${plan}`)
        break
      }

      // Subscription atualizada (upgrade/downgrade)
      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = event.data.object as any
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        const priceId = sub.items.data[0]?.price?.id
        const plan = priceId ? (await getPlanFromPriceId(priceId)) || 'starter' : 'starter'
        const supabase = getSupabaseAdmin()

        try {
          // Se cancelamento agendado, salvar pending state
          if (sub.cancel_at_period_end) {
            await supabase.from('organizations').update({
              pending_plan: 'trial',
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: true,
            }).eq('id', orgId)
            serverLogger.info(`[Stripe] Subscription cancel scheduled: org ${orgId} → trial em ${new Date(sub.current_period_end * 1000).toLocaleDateString()}`)
          } else {
            // Mudanca imediata ou restauracao
            await updateOrgPlan(orgId, plan, {
              pending_plan: null,
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: false,
            })
            serverLogger.info(`[Stripe] Subscription updated: org ${orgId} → ${plan}`)
          }
        } catch (updateErr) {
          serverLogger.error('[Stripe Webhook] DB update failed (customer.subscription.updated)', { error: updateErr instanceof Error ? updateErr.message : String(updateErr) })
          hasErrors = true
        }

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
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            pending_plan: null,
            current_period_end: null,
            cancel_at_period_end: false,
          })
        } catch (updateErr) {
          serverLogger.error('[Stripe Webhook] DB update failed (customer.subscription.deleted)', { error: updateErr instanceof Error ? updateErr.message : String(updateErr) })
          hasErrors = true
        }

        serverLogger.info(`[Stripe] Subscription deleted: org ${orgId} → trial`)
        break
      }

      // Pagamento falhou → notificar admins da org
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : ''
        serverLogger.info(`[Stripe] Payment failed for customer ${customerId}`)

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
                serverLogger.error('[Stripe Webhook] DB insert notifications failed', { error: notifErr instanceof Error ? notifErr.message : String(notifErr) })
                hasErrors = true
              } else {
                serverLogger.info(`[Stripe] Notificou ${admins.length} admin(s) da org ${failedOrg.id}`)
              }
            }
          }
        }
        break
      }

      default:
        serverLogger.info(`[Stripe Webhook] Evento nao processado: ${event.type}`)
    }

    if (hasErrors) {
      serverLogger.error('[Stripe Webhook] Evento processado com erros', { detail: event.type })
    }

    // Marcar evento como processado (idempotencia)
    try { await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type }) } catch { /* ignore duplicate */ }

    return NextResponse.json({ received: true })
  } catch (err) {
    serverLogger.error('[Stripe Webhook] Erro ao processar', { error: err instanceof Error ? err.message : String(err) })
    try { await supabase.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type }) } catch { /* ignore */ }
    return NextResponse.json({ received: true })
  }
}
