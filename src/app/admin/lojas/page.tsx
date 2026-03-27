import { requireAdmin } from '@/lib/server-auth'
import LojasPageClient from './LojasPageClient'

export default async function LojasPage() {
  const { user, supabase } = await requireAdmin()

  // Fetch stores
  const { data: storesData } = await supabase
    .from('stores')
    .select('*')
    .order('name')

  // Get stats per store
  const storesWithStats = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (storesData ?? []).map(async (store: any) => {
      const { count: userCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
      const { count: checklistCount } = await supabase
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', store.id)
      return { ...store, user_count: userCount || 0, checklist_count: checklistCount || 0 }
    })
  )

  // Get org plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgMember } = await (supabase as any)
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  let orgPlan = 'enterprise'
  if (orgMember?.org_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('plan')
      .eq('id', orgMember.org_id)
      .single()
    if (org?.plan) orgPlan = org.plan
  }

  return (
    <LojasPageClient
      initialStores={storesWithStats}
      initialOrgPlan={orgPlan}
    />
  )
}
