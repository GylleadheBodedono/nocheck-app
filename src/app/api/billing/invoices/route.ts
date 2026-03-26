export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getSupabaseAdmin } from '@/lib/stripe'

/**
 * GET /api/billing/invoices?orgId=xxx
 * Retorna faturas e metodos de pagamento do cliente no Stripe.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId')
    if (!orgId) return NextResponse.json({ error: 'orgId obrigatorio' }, { status: 400 })

    const supabase = getSupabaseAdmin()
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ invoices: [], paymentMethods: [], defaultPaymentMethod: null })
    }

    const stripe = getStripe()

    // Buscar faturas
    const invoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: 20,
    })

    // Buscar metodos de pagamento
    const paymentMethods = await stripe.paymentMethods.list({
      customer: org.stripe_customer_id,
      type: 'card',
    })

    // Buscar default payment method
    const customer = await stripe.customers.retrieve(org.stripe_customer_id) as { invoice_settings?: { default_payment_method?: string } }
    const defaultPm = customer.invoice_settings?.default_payment_method || null

    return NextResponse.json({
      invoices: invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        created: inv.created,
        dueDate: inv.due_date,
        paidAt: inv.status_transitions?.paid_at,
        hostedUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf,
      })),
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand || 'unknown',
        last4: pm.card?.last4 || '****',
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultPm,
      })),
    })
  } catch (err) {
    console.error('[API /billing/invoices] Erro:', err)
    return NextResponse.json({ error: 'Falha ao buscar dados de pagamento' }, { status: 500 })
  }
}
