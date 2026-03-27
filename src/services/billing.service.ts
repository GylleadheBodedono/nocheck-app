// ============================================
// SERVICE — Billing (Stripe via API Routes)
// ============================================
// Integracao com Stripe para gerenciamento de assinaturas.
// Usa API routes do Next.js (/api/billing/*).
//
// Os tipos de parâmetros e retorno são importados dos DTOs
// centralizados em /dtos/billing.dto.ts para garantir
// consistência entre cliente e servidor.
// ============================================

// Importa tipos centralizados de billing — substitui interfaces locais
import type {
  CheckoutRequestDTO,
  PortalRequestDTO,
  SubscriptionStatusResponseDTO,
  BillingRedirectResponseDTO,
} from '@/dtos'

/**
 * Cria uma sessao de checkout no Stripe para upgrade de plano.
 * Redireciona o usuario para a pagina de pagamento do Stripe.
 *
 * @param params - Dados da sessao de checkout (CheckoutRequestDTO)
 * @returns URL do checkout do Stripe para redirecionamento
 * @throws Error se a API retornar erro
 */
export async function createCheckoutSession(params: CheckoutRequestDTO): Promise<BillingRedirectResponseDTO> {
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
 * @param params - Dados da sessao do portal (PortalRequestDTO)
 * @returns URL do portal do Stripe para redirecionamento
 * @throws Error se a API retornar erro
 */
export async function createPortalSession(params: PortalRequestDTO): Promise<BillingRedirectResponseDTO> {
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
 * @returns Status da assinatura com periodo atual e flag de cancelamento (SubscriptionStatusResponseDTO)
 * @throws Error se a API retornar erro
 */
export async function getSubscriptionStatus(params: { orgId: string }): Promise<SubscriptionStatusResponseDTO> {
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
