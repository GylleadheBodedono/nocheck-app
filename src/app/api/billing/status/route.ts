// ============================================
// API: Consultar status da subscription Stripe
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-02-25.clover' })

export async function POST(req: NextRequest) {
  try {
    const { orgId } = await req.json()

    if (!orgId) {
      return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
