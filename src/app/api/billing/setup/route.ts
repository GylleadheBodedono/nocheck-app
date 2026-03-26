// ============================================
// API: Setup Stripe Products (executar UMA vez)
// ============================================
// Cria os 3 produtos (Starter, Professional, Enterprise) no Stripe
// com precos recorrentes mensais em BRL.
// Retorna os price IDs para atualizar PLAN_CONFIGS.
// ============================================

export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { verifyApiAuth } from '@/lib/api-auth'

const PLANS = [
  { name: 'OpereCheck Starter', price: 29700, plan: 'starter' },       // R$ 297
  { name: 'OpereCheck Professional', price: 59700, plan: 'professional' }, // R$ 597
  { name: 'OpereCheck Enterprise', price: 99700, plan: 'enterprise' },    // R$ 997
]

export async function POST(req: NextRequest) {
  try {
    // Setup so pode ser chamado por platform admin autenticado
    const auth = await verifyApiAuth(req, true)
    if (auth.error) return auth.error
    const { checkIsPlatformAdmin } = await import('@/lib/withTenantAuth')
    const isPlatformAdmin = checkIsPlatformAdmin(auth.user as Record<string, unknown>)
    if (!isPlatformAdmin) {
      return NextResponse.json({ error: 'Apenas platform admin pode executar setup' }, { status: 403 })
    }
    const results: Record<string, { productId: string; priceId: string }> = {}

    const stripe = getStripe()
    for (const plan of PLANS) {
      // Criar produto
      const product = await stripe.products.create({
        name: plan.name,
        metadata: { plan: plan.plan },
      })

      // Criar preco recorrente mensal em BRL
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price, // em centavos
        currency: 'brl',
        recurring: { interval: 'month' },
        metadata: { plan: plan.plan },
      })

      results[plan.plan] = { productId: product.id, priceId: price.id }
    }

    return NextResponse.json({
      message: 'Produtos criados com sucesso no Stripe Test Mode',
      products: results,
      instructions: 'Copie os priceId e atualize PLAN_CONFIGS em src/types/tenant.ts',
    })
  } catch (err) {
    console.error('[Stripe Setup] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar produtos' },
      { status: 500 }
    )
  }
}
