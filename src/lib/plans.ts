import { PLAN_CONFIGS, type Plan, type PlanConfig } from '@/types/tenant'

export const TRIAL_DAYS = 14
export { PLAN_CONFIGS }

/** Busca pricing dinamico de /api/pricing com fallback para PLAN_CONFIGS. */
export async function fetchPlanConfigs(): Promise<Record<Plan, PlanConfig>> {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL || '')
    const res = await fetch(`${baseUrl}/api/pricing`, { next: { revalidate: 300 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('Empty')
    const configs: Record<string, PlanConfig> = {}
    for (const row of rows) {
      configs[row.id] = { id: row.id, name: row.name, price: row.price_brl, maxUsers: row.max_users, maxStores: row.max_stores, features: row.features, stripePriceId: row.stripe_price_id || '' }
    }
    return configs as Record<Plan, PlanConfig>
  } catch {
    return PLAN_CONFIGS
  }
}
