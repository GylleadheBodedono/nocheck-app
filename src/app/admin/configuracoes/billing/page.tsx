// ============================================
// Billing — Server Component (data fetching)
// ============================================

import { requireAdmin } from '@/lib/server-auth'
import BillingPageClient from './BillingPageClient'

export default async function BillingPage() {
  const { supabase } = await requireAdmin()

  // Cast to any — RPC functions are not typed in the generated Supabase types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Get org billing info using RPC
  const tenantRes = await sb.rpc('get_my_tenant_id')
  const orgId = tenantRes.data || null

  let orgBilling = null
  let usage = { currentUsers: 0, currentStores: 0 }

  if (orgId) {
    const orgRes = await sb.rpc('get_org_billing', { p_org_id: orgId })
    if (orgRes.data && orgRes.data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = orgRes.data[0] as any
      orgBilling = {
        ...raw,
        pending_plan: raw.pending_plan ?? null,
        previous_plan: raw.previous_plan ?? null,
        current_period_end: raw.current_period_end ?? null,
        cancel_at_period_end: raw.cancel_at_period_end ?? false,
      }
      usage = {
        currentUsers: Number(raw.current_users) || 0,
        currentStores: Number(raw.current_stores) || 0,
      }
    }
  }

  return (
    <BillingPageClient
      initialOrg={orgBilling}
      initialUsage={usage}
    />
  )
}
