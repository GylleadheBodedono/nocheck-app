// ============================================
// Plan Limits — Verificacao de limites do plano
// ============================================
// Funcoes utilitarias para verificar se a organizacao
// atingiu o limite de usuarios ou lojas do plano atual.
// Usado tanto no servidor (API routes) quanto no cliente.
// ============================================

import { PLAN_CONFIGS, type Plan } from '@/types/tenant'

export type PlanLimitCheck = {
  allowed: boolean
  current: number
  max: number
  plan: string
}

/**
 * Verifica se a org pode adicionar mais usuarios.
 * Retorna { allowed, current, max, plan }
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
 * Verifica se a org pode adicionar mais lojas.
 * Retorna { allowed, current, max, plan }
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
 * Mensagem de erro padrao para limite atingido.
 */
export function getLimitMessage(type: 'users' | 'stores', check: PlanLimitCheck): string {
  const label = type === 'users' ? 'usuários' : 'lojas'
  return `Limite de ${label} atingido (${check.current}/${check.max}). Faça upgrade do plano ${check.plan} para adicionar mais.`
}
