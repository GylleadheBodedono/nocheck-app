// ============================================
// API: Criar Stripe Customer Portal Session
// ============================================
// Abre o portal do Stripe onde o admin pode:
// - Trocar plano, atualizar cartao, cancelar assinatura
// ============================================

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { orgId, returnUrl } = await req.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: 'Plano configurado manualmente. Para gerenciar pagamentos, faca um upgrade via Stripe.' }, { status: 400 })
    }

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: returnUrl || `${req.headers.get('origin')}/admin/configuracoes`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[Billing Portal] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao abrir portal' },
      { status: 500 }
    )
  }
}
