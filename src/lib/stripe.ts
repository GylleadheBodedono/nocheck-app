// ============================================
// UTILITARIO COMPARTILHADO: Stripe + Supabase Admin
// ============================================
// Centraliza a criacao do cliente Stripe e do Supabase Admin (service role),
// evitando duplicacao em todas as rotas de billing/webhook.
//
// Tambem contem helpers para mapear price IDs → planos e
// atualizar a organizacao com os dados do plano.
// ============================================

import Stripe from 'stripe'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'

// --- Instancias singleton (lazy) ---
let _stripe: Stripe | null = null
let _supabaseAdmin: SupabaseClient | null = null

/**
 * Retorna o cliente Stripe (singleton).
 * Cria a instancia apenas na primeira chamada e reutiliza nas seguintes,
 * evitando criar um novo objeto Stripe a cada request.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

/**
 * Retorna o cliente Supabase com service_role (singleton).
 * Usa a chave de servico para bypassar RLS — indicado apenas
 * para operacoes de backend (webhooks, APIs internas).
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  }
  return _supabaseAdmin
}

/**
 * Mapeia um Stripe price_id para o nome do plano correspondente.
 * Percorre PLAN_CONFIGS procurando o priceId que bate.
 *
 * @param priceId - ID do preco no Stripe (ex: "price_1TC1hW...")
 * @returns Nome do plano (ex: "starter") ou null se nao encontrar
 */
export function getPlanFromPriceId(priceId: string): string | null {
  for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
    if (config.stripePriceId === priceId) return plan
  }
  return null
}

/**
 * Retorna a lista de features habilitadas para um plano.
 * Se o plano nao for encontrado, retorna as features do trial como fallback.
 *
 * @param plan - Nome do plano (ex: "professional")
 * @returns Array de features habilitadas
 */
export function getFeaturesForPlan(plan: string): string[] {
  const config = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS]
  return config?.features || PLAN_CONFIGS.trial.features
}

/**
 * Atualiza a organizacao no banco com os dados do plano:
 * plan, features, max_users e max_stores.
 *
 * Usado no webhook do Stripe quando a subscription e criada/atualizada.
 *
 * @param orgId - UUID da organizacao
 * @param plan - Nome do plano (ex: "starter", "professional", "enterprise")
 * @param extraFields - Campos adicionais para atualizar (ex: stripe_customer_id, trial_ends_at)
 */
export async function updateOrgPlan(
  orgId: string,
  plan: string,
  extraFields: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const features = getFeaturesForPlan(plan)
  const config = PLAN_CONFIGS[plan as Plan]

  const { error } = await supabase.from('organizations').update({
    plan,
    features,
    max_users: config?.maxUsers || 5,
    max_stores: config?.maxStores || 3,
    ...extraFields,
  }).eq('id', orgId)

  if (error) {
    console.error('[Stripe] updateOrgPlan failed:', error)
    throw new Error(`Failed to update org plan: ${error.message}`)
  }
}
