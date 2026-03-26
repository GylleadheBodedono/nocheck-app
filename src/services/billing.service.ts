// ============================================
// SERVICE — Billing (Stripe via API Routes)
// ============================================
// Integracao com Stripe para gerenciamento de assinaturas.
// Usa API routes do Next.js (/api/billing/*).
// ============================================

/** Parametros para criar uma sessao de checkout */
interface CheckoutSessionParams {
  /** ID da organizacao no Supabase */
  orgId: string
  /** ID do preco no Stripe (ex: "price_xxx") */
  priceId: string
  /** URL de redirecionamento apos sucesso */
  successUrl?: string
  /** URL de redirecionamento apos cancelamento */
  cancelUrl?: string
}

/** Parametros para abrir o portal de gerenciamento */
interface PortalSessionParams {
  /** ID da organizacao no Supabase */
  orgId: string
  /** URL de retorno apos sair do portal */
  returnUrl?: string
}

/** Status da assinatura retornado pela API */
interface SubscriptionStatus {
  /** Status atual no Stripe (ex: "active", "past_due", "canceled") */
  status: string
  /** Data de fim do periodo atual (ISO 8601) ou null */
  currentPeriodEnd: string | null
  /** Se a assinatura sera cancelada no fim do periodo */
  cancelAtPeriodEnd: boolean
}

/**
 * Cria uma sessao de checkout no Stripe para upgrade de plano.
 * Redireciona o usuario para a pagina de pagamento do Stripe.
 *
 * @param params - Dados da sessao de checkout
 * @returns URL do checkout do Stripe para redirecionamento
 * @throws Error se a API retornar erro
 */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<{ url: string }> {
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

/**
 * Cria uma sessao do portal do Stripe para gerenciar assinatura.
 * Permite ao usuario alterar plano, metodo de pagamento, cancelar, etc.
 *
 * @param params - Dados da sessao do portal
 * @returns URL do portal do Stripe para redirecionamento
 * @throws Error se a API retornar erro
 */
export async function createPortalSession(params: PortalSessionParams): Promise<{ url: string }> {
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

/**
 * Consulta o status atual da assinatura no Stripe.
 *
 * @param params - ID da organizacao
 * @returns Status da assinatura com periodo atual e flag de cancelamento
 * @throws Error se a API retornar erro
 */
export async function getSubscriptionStatus(params: { orgId: string }): Promise<SubscriptionStatus> {
  const res = await fetch('/api/billing/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Erro ao consultar status')
  }
  return res.json()
}

/** Milissegundos em um dia (usado no calculo de dias restantes) */
const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Calcula quantos dias faltam para o trial expirar.
 *
 * @param trialEndsAt - Data de fim do trial (ISO 8601) ou null
 * @returns Numero de dias restantes (minimo 0)
 */
export function getTrialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0
  const diff = new Date(trialEndsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}
