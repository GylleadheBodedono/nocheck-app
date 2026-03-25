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

/** Busca config de um plano do pricing_configs (DB), com fallback para PLAN_CONFIGS. */
async function getPricingConfig(planId: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('pricing_configs').select('*').eq('id', planId).single()
    if (data) return { features: data.features as string[], maxUsers: data.max_users as number, maxStores: data.max_stores as number, stripePriceId: (data.stripe_price_id || '') as string }
  } catch { /* fallback */ }
  const fallback = PLAN_CONFIGS[planId as Plan]
  return fallback ? { features: fallback.features, maxUsers: fallback.maxUsers, maxStores: fallback.maxStores, stripePriceId: fallback.stripePriceId } : null
}

/** Mapeia Stripe price_id → plano. Busca em pricing_configs, fallback PLAN_CONFIGS. */
export async function getPlanFromPriceId(priceId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase.from('pricing_configs').select('id').eq('stripe_price_id', priceId).single()
    if (data) return data.id
  } catch { /* fallback */ }
  for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
    if (config.stripePriceId === priceId) return plan
  }
  return null
}

/** Retorna features de um plano. Busca em pricing_configs, fallback PLAN_CONFIGS. */
export async function getFeaturesForPlan(plan: string): Promise<string[]> {
  const config = await getPricingConfig(plan)
  return config?.features || PLAN_CONFIGS.trial.features
}

/** Atualiza org no banco com dados do plano (features, limits). Busca do DB. */
export async function updateOrgPlan(
  orgId: string,
  plan: string,
  extraFields: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const config = await getPricingConfig(plan)

  const { error } = await supabase.from('organizations').update({
    plan,
    features: config?.features || PLAN_CONFIGS.trial.features,
    max_users: config?.maxUsers || 5,
    max_stores: config?.maxStores || 3,
    ...extraFields,
  }).eq('id', orgId)

  if (error) {
    console.error('[Stripe] updateOrgPlan failed:', error)
    throw new Error(`Failed to update org plan: ${error.message}`)
  }
}
