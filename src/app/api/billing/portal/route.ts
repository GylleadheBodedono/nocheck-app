// ============================================
// API: Criar Stripe Customer Portal Session
// ============================================
// Abre o portal do Stripe onde o admin pode:
// - Trocar plano, atualizar cartao, cancelar assinatura
// ============================================

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'
import { verifyTenantAccess } from '@/lib/withTenantAuth'

export async function POST(req: NextRequest) {
  try {
    const { orgId, returnUrl } = await req.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const tenantAuth = await verifyTenantAccess(req, orgId)
    if (tenantAuth.error) return tenantAuth.error

    const supabase = getSupabaseAdmin()

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: 'Nenhuma assinatura Stripe encontrada. Faca um upgrade primeiro para ativar o gerenciamento de pagamentos.' }, { status: 400 })
    }

    // Validar return URL (prevenir open redirect)
    const appOrigin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || ''
    const safeReturnUrl = (returnUrl && (returnUrl.startsWith('/') || returnUrl.startsWith(appOrigin)))
      ? returnUrl
      : `${appOrigin}/admin/configuracoes`

    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: safeReturnUrl,
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
