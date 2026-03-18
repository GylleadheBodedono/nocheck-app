// ============================================
// API: Consultar status da subscription Stripe
// ============================================

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_subscription_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({
        status: 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      })
    }

    const stripe = getStripe()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id) as any

    return NextResponse.json({
      status: sub.status ?? sub.data?.status ?? 'unknown',
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    })
  } catch (err) {
    console.error('[Billing Status] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao consultar status' },
      { status: 500 }
    )
  }
}
