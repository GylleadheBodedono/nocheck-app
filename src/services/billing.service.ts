// ============================================
// SERVICE — Billing (Stripe via API Routes)
// ============================================
// Integracao com Stripe para gerenciamento de assinaturas.
// Usa API routes do Next.js (/api/billing/*).
// ============================================

/** Cria sessao de checkout no Stripe para upgrade de plano */
export async function createCheckoutSession(params: {
  orgId: string
  priceId: string
  successUrl?: string
  cancelUrl?: string
}): Promise<{ url: string }> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Erro ao criar checkout')
  }
  return res.json()
}

/** Abre portal do Stripe para gerenciar assinatura */
export async function createPortalSession(params: {
  orgId: string
  returnUrl?: string
}): Promise<{ url: string }> {
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Erro ao abrir portal')
  }
  return res.json()
}

/** Calcula dias restantes do trial */
export function getTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
