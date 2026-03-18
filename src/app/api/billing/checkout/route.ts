// ============================================
// API: Criar Stripe Checkout Session
// ============================================
// Cria sessao de pagamento para upgrade de plano.
// Se a org nao tem stripe_customer_id, cria um customer novo.
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })
}

export async function POST(req: NextRequest) {
  try {
    const { orgId, priceId, successUrl, cancelUrl } = await req.json()

    if (!orgId || !priceId) {
      return NextResponse.json({ error: 'orgId e priceId sao obrigatorios' }, { status: 400 })
    }

    const stripe = getStripe()

    // Buscar org no banco (service role bypassa RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, slug, stripe_customer_id')
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

      // Salvar customer_id na org
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
    }

    // Criar checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/admin/configuracoes?billing=success`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/admin/configuracoes?billing=cancelled`,
      metadata: { org_id: orgId },
      subscription_data: { metadata: { org_id: orgId } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Billing Checkout] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar checkout' },
      { status: 500 }
    )
  }
}
