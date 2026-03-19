export const runtime = 'edge'

// ============================================
// API: Criar Subscription com Payment Method inline
// ============================================
// Recebe orgId, priceId e paymentMethodId (criado no frontend via Stripe Elements).
// Cria/reutiliza customer, attach payment method, cria subscription.
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin, updateOrgPlan, getPlanFromPriceId } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { orgId, priceId, paymentMethodId } = await req.json()

    if (!orgId || !priceId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'orgId, priceId e paymentMethodId sao obrigatorios' },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const supabase = getSupabaseAdmin()

    // Buscar org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, stripe_customer_id, stripe_subscription_id')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organizacao nao encontrada' }, { status: 404 })
    }

    // Buscar ou criar Stripe Customer
    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: org.id, org_slug: org.slug },
      })
      customerId = customer.id

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
    }

    // Attach payment method ao customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId })

    // Setar como default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Se ja tem subscription ativa, atualizar o plano
    if (org.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
      const updatedSub = await stripe.subscriptions.update(org.stripe_subscription_id, {
        items: [{ id: subscription.items.data[0].id, price: priceId }],
        default_payment_method: paymentMethodId,
        proration_behavior: 'create_prorations',
      })

      const plan = getPlanFromPriceId(priceId)
      if (plan) {
        await updateOrgPlan(orgId, plan, {
          stripe_subscription_id: updatedSub.id,
          trial_ends_at: null,
        })
      }

      return NextResponse.json({ success: true, subscriptionId: updatedSub.id })
    }

    // Criar nova subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { org_id: orgId },
      expand: ['latest_invoice.payment_intent'],
    })

    // Verificar status do pagamento
    const invoice = subscription.latest_invoice as { payment_intent?: { status: string; client_secret: string } } | null
    const paymentIntent = invoice?.payment_intent

    if (paymentIntent?.status === 'requires_action') {
      // Precisa de 3D Secure
      return NextResponse.json({
        success: false,
        requires_action: true,
        client_secret: paymentIntent.client_secret,
        subscriptionId: subscription.id,
      })
    }

    // Pagamento OK — atualizar plano
    const plan = getPlanFromPriceId(priceId)
    if (plan) {
      await updateOrgPlan(orgId, plan, {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        trial_ends_at: null,
      })
    }

    return NextResponse.json({ success: true, subscriptionId: subscription.id })
  } catch (err) {
    console.error('[Billing Subscribe] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar assinatura' },
      { status: 500 }
    )
  }
}
