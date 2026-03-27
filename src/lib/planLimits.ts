// ============================================
// Plan Limits — Verificacao de limites do plano
// ============================================
// Funcoes utilitarias para verificar se a organizacao
// atingiu o limite de usuarios ou lojas do plano atual.
// Usado tanto no servidor (API routes) quanto no cliente.
// ============================================

import { PLAN_CONFIGS, type Plan } from '@/types/tenant'

/**
 * Resultado da verificacao de limite de um recurso.
 * Indica se a organizacao pode adicionar mais itens
 * e os valores atuais/maximos para exibicao na UI.
 */
export type PlanLimitCheck = {
  /** Se a organizacao pode adicionar mais itens */
  allowed: boolean
  /** Quantidade atual de itens */
  current: number
  /** Limite maximo do plano (ou override) */
  max: number
  /** Nome do plano atual */
  plan: string
}

/**
 * Verifica se a organizacao pode adicionar mais usuarios.
 *
 * @param currentUsers - Numero atual de usuarios na organizacao
 * @param plan - Plano atual da organizacao
 * @param maxUsersOverride - Limite customizado (sobrescreve o padrao do plano)
 * @returns Resultado com `allowed` indicando se pode adicionar mais
 *
 * @example
 * ```ts
 * const check = checkUserLimit(5, 'starter')
 * if (!check.allowed) {
 *   toast.error(getLimitMessage('users', check))
 * }
 * ```
 */
export function checkUserLimit(
  currentUsers: number,
  plan: Plan,
  maxUsersOverride?: number
): PlanLimitCheck {
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.trial
  const max = maxUsersOverride ?? config.maxUsers

  return {
    allowed: currentUsers < max,
    current: currentUsers,
    max,
    plan,
  }
}

/**
 * Verifica se a organizacao pode adicionar mais lojas.
 *
 * @param currentStores - Numero atual de lojas na organizacao
 * @param plan - Plano atual da organizacao
 * @param maxStoresOverride - Limite customizado (sobrescreve o padrao do plano)
 * @returns Resultado com `allowed` indicando se pode adicionar mais
 *
 * @example
 * ```ts
 * const check = checkStoreLimit(3, 'professional')
 * if (!check.allowed) {
 *   toast.error(getLimitMessage('stores', check))
 * }
 * ```
 */
export function checkStoreLimit(
  currentStores: number,
  plan: Plan,
  maxStoresOverride?: number
): PlanLimitCheck {
  const config = PLAN_CONFIGS[plan] || PLAN_CONFIGS.trial
  const max = maxStoresOverride ?? config.maxStores

  return {
    allowed: currentStores < max,
    current: currentStores,
    max,
    plan,
  }
}

/**
 * Gera mensagem de erro padrao para exibir quando o limite e atingido.
 *
 * @param type - Tipo de recurso ("users" ou "stores")
 * @param check - Resultado da verificacao de limite
 * @returns Mensagem formatada para exibir ao usuario
 */
export function getLimitMessage(type: 'users' | 'stores', check: PlanLimitCheck): string {
  const label = type === 'users' ? 'usuários' : 'lojas'
  return `Limite de ${label} atingido (${check.current}/${check.max}). Faça upgrade do plano ${check.plan} para adicionar mais.`
}
