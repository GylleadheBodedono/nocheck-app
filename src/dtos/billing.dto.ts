// ============================================
// DTOs — Billing (Stripe / Assinaturas)
// ============================================
// Tipos de transferência para todas as operações
// de cobrança: checkout, portal, status, faturas,
// mudança de plano e assinatura direta.
//
// Todas as requisições exigem `orgId` (UUID da organização)
// para verificação de acesso via `verifyTenantAccess`.
// ============================================

import type { Plan } from '@/types/tenant'

// ─────────────────────────────────────────────
// REQUISIÇÕES
// ─────────────────────────────────────────────

/**
 * Body do POST /api/billing/checkout
 * Cria uma sessão de checkout no Stripe para upgrade de plano.
 * O usuário é redirecionado para a página de pagamento do Stripe.
 */
export interface CheckoutRequestDTO {
  /** UUID da organização no Supabase */
  orgId: string
  /** ID do preço no Stripe (ex: "price_1TC1hW2...") */
  priceId: string
  /**
   * URL de redirecionamento após pagamento bem-sucedido.
   * Deve começar com "/" ou com a origem do app para prevenir open redirect.
   */
  successUrl?: string
  /**
   * URL de redirecionamento ao cancelar o checkout.
   * Deve começar com "/" ou com a origem do app.
   */
  cancelUrl?: string
}

/**
 * Body do POST /api/billing/portal
 * Abre o portal de gerenciamento do Stripe para o cliente.
 * Permite alterar plano, método de pagamento ou cancelar.
 */
export interface PortalRequestDTO {
  /** UUID da organização no Supabase */
  orgId: string
  /** URL de retorno ao fechar o portal */
  returnUrl?: string
}

/**
 * Body do POST /api/billing/status
 * Consulta o status atual da assinatura da organização no Stripe.
 */
export interface SubscriptionStatusRequestDTO {
  /** UUID da organização no Supabase */
  orgId: string
}

/**
 * Body do POST /api/billing/change-plan
 * Altera o plano de assinatura (upgrade imediato ou downgrade agendado).
 *
 * Regras de negócio:
 * - Trial → pago: não suportado aqui, use /api/billing/checkout
 * - Pago → superior: aplica imediatamente com proration
 * - Pago → inferior: agenda para fim do período atual
 * - Pago → trial: cancela no fim do período
 */
export interface ChangePlanRequestDTO {
  /** UUID da organização no Supabase */
  orgId: string
  /** Plano de destino */
  newPlan: Plan
}

/**
 * Body do POST /api/billing/subscribe
 * Cria uma assinatura com pagamento inline (sem redirect para o Stripe).
 * Usado pelo PaymentModal para assinatura direta com cartão.
 */
export interface SubscribeRequestDTO {
  /** UUID da organização no Supabase */
  orgId: string
  /** ID do preço no Stripe */
  priceId: string
  /** ID do método de pagamento registrado no Stripe */
  paymentMethodId: string
}

// ─────────────────────────────────────────────
// RESPOSTAS
// ─────────────────────────────────────────────

/**
 * Resposta dos endpoints que retornam URL para redirecionamento.
 * Usado por: POST /api/billing/checkout, POST /api/billing/portal
 */
export interface BillingRedirectResponseDTO {
  /** URL do Stripe para onde o usuário deve ser redirecionado */
  url: string
}

/**
 * Status atual da assinatura da organização no Stripe.
 * Retornado por POST /api/billing/status.
 */
export interface SubscriptionStatusResponseDTO {
  /** Status no Stripe: "active", "past_due", "canceled", "trialing", etc. */
  status: string
  /** Data de fim do período atual (ISO 8601) ou null se não há assinatura */
  currentPeriodEnd: string | null
  /** Se true, a assinatura será cancelada ao fim do período atual */
  cancelAtPeriodEnd: boolean
}

/**
 * Resposta de POST /api/billing/change-plan para upgrade imediato.
 * O upgrade é aplicado na hora com proration no Stripe.
 */
export interface UpgradeResponseDTO {
  success: boolean
  /** Sempre true para upgrades — indica aplicação imediata */
  applied: true
  /** Mensagem de confirmação para o usuário */
  message: string
}

/**
 * Resposta de POST /api/billing/change-plan para downgrade ou cancelamento.
 * A mudança é agendada para o fim do período atual.
 */
export interface ScheduledChangeResponseDTO {
  success: boolean
  /** false ou undefined para mudanças agendadas */
  applied?: false
  /** Plano que entrará em vigor na data efetiva */
  pendingPlan: Plan
  /** Plano mantido até a data efetiva */
  previousPlan: Plan
  /** Data ISO em que a mudança será aplicada */
  effectiveDate: string
  /** Mensagem explicativa para exibir ao usuário */
  message: string
}

/**
 * Dados de uma fatura individual do Stripe.
 * Retornado no array `invoices` de GET /api/billing/invoices.
 */
export interface InvoiceDTO {
  /** ID único da fatura no Stripe */
  id: string
  /** Número sequencial da fatura (ex: "XXXX-0001") */
  number: string | null
  /** Valor total em centavos da moeda */
  amount: number
  /** Código da moeda (ex: "brl") */
  currency: string
  /** Status da fatura: "paid", "open", "void", "uncollectible" */
  status: string | null
  /** Timestamp Unix de criação da fatura */
  created: number
  /** Timestamp Unix do vencimento ou null */
  dueDate: number | null
  /** Timestamp Unix de quando foi paga ou null */
  paidAt: number | null | undefined
  /** URL para visualizar a fatura no painel do Stripe */
  hostedUrl: string | null
  /** URL do PDF da fatura para download */
  pdfUrl: string | null
}

/**
 * Dados de um cartão de crédito/débito cadastrado no Stripe.
 * Retornado no array `paymentMethods` de GET /api/billing/invoices.
 */
export interface PaymentMethodDTO {
  /** ID do método de pagamento no Stripe */
  id: string
  /** Bandeira do cartão: "visa", "mastercard", "elo", etc. */
  brand: string
  /** Últimos 4 dígitos do cartão */
  last4: string
  /** Mês de expiração (1-12) */
  expMonth: number | undefined
  /** Ano de expiração (ex: 2027) */
  expYear: number | undefined
  /** Se este é o método de pagamento padrão da organização */
  isDefault: boolean
}

/**
 * Resposta do GET /api/billing/invoices.
 * Lista faturas e métodos de pagamento da organização.
 */
export interface InvoicesResponseDTO {
  /** Faturas dos últimos pagamentos (máx. 20) */
  invoices: InvoiceDTO[]
  /** Cartões cadastrados no Stripe */
  paymentMethods: PaymentMethodDTO[]
}
