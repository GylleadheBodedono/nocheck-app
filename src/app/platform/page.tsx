import { requirePlatformAdmin } from '@/lib/server-auth'
import { PLAN_CONFIGS } from '@/types/tenant'
import PlatformDashboardClient from './PlatformDashboardClient'

export default async function PlatformDashboard() {
  const { user, supabase } = await requirePlatformAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch organizations (exclude superadmin org)
  const { data: orgList } = await sb.from('organizations').select('id, name, slug, plan, is_active, created_at, trial_ends_at')
  const { data: adminProfile } = await sb.from('users').select('tenant_id').eq('id', user.id).single()
  const adminOrgId = adminProfile?.tenant_id
  const all = (orgList || []).filter((o: { id: string }) => o.id !== adminOrgId)
  const active = all.filter((o: { is_active: boolean }) => o.is_active)
  const trial = all.filter((o: { plan: string }) => o.plan === 'trial')

  // Calculate MRR
  let mrr = 0
  for (const o of active) {
    const p = PLAN_CONFIGS[o.plan as keyof typeof PLAN_CONFIGS]
    if (p) mrr += p.price
  }

  // Counts
  const { count: uc } = await sb.from('users').select('id', { count: 'exact', head: true })
  const { count: sc } = await sb.from('stores').select('id', { count: 'exact', head: true })
  const { count: cc } = await sb.from('checklists').select('id', { count: 'exact', head: true })

  const stats = {
    totalOrgs: all.length,
    activeOrgs: active.length,
    trialOrgs: trial.length,
    totalUsers: uc || 0,
    totalStores: sc || 0,
    totalChecklists: cc || 0,
    mrr,
  }

  // Member and store counts per org
  const { data: members } = await sb.from('organization_members').select('organization_id')
  const mm: Record<string, number> = {}
  for (const m of (members || [])) mm[m.organization_id] = (mm[m.organization_id] || 0) + 1

  const { data: stores } = await sb.from('stores').select('tenant_id')
  const sm: Record<string, number> = {}
  for (const s of (stores || [])) sm[s.tenant_id] = (sm[s.tenant_id] || 0) + 1

  // Recent orgs (top 10)
  const recentOrgs = all
    .sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
    .map((o: { id: string; name: string; slug: string; plan: string; is_active: boolean; created_at: string; trial_ends_at: string | null }) => ({
      ...o,
      member_count: mm[o.id] || 0,
      store_count: sm[o.id] || 0,
    }))

  // Build org name map
  const orgMap = new Map(all.map((o: { id: string; name: string }) => [o.id, o.name]))

  // Rankings
  // 1. Most Loyal — orgs with most completed checklists (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: completedChecklists } = await sb.from('checklists').select('tenant_id').eq('status', 'completed').gte('created_at', thirtyDaysAgo)
  let mostLoyal: { org_id: string; org_name: string; value: string }[] = []
  if (completedChecklists) {
    const counts: Record<string, number> = {}
    for (const c of completedChecklists) counts[c.tenant_id] = (counts[c.tenant_id] || 0) + 1
    mostLoyal = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({
      org_id: id, org_name: (orgMap.get(id) as string) || id, value: `${count} checklists`
    }))
  }

  // 2. Oldest clients
  const oldest = all
    .sort((a: { created_at: string }, b: { created_at: string }) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 5)
    .map((o: { id: string; name: string; created_at: string }) => ({
      org_id: o.id, org_name: o.name, value: new Date(o.created_at).toLocaleDateString('pt-BR')
    }))

  // 3. Most delayed — orgs with most pending/in_progress checklists
  const { data: pendingChecklists } = await sb.from('checklists').select('tenant_id').in('status', ['pending', 'in_progress'])
  let mostDelayed: { org_id: string; org_name: string; value: string }[] = []
  if (pendingChecklists) {
    const counts: Record<string, number> = {}
    for (const c of pendingChecklists) counts[c.tenant_id] = (counts[c.tenant_id] || 0) + 1
    mostDelayed = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({
      org_id: id, org_name: (orgMap.get(id) as string) || id, value: `${count} pendentes`
    }))
  }

  // 4 & 5. Activity rankings (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: activityData } = await sb.from('activity_log').select('tenant_id').gte('created_at', sevenDaysAgo)
  const actCounts: Record<string, number> = {}
  for (const o of active) actCounts[o.id] = 0
  if (activityData) {
    for (const a of activityData) {
      if (a.tenant_id) actCounts[a.tenant_id] = (actCounts[a.tenant_id] || 0) + 1
    }
  }
  const sortedActivity = Object.entries(actCounts).sort((a, b) => b[1] - a[1])
  const mostActive = sortedActivity.slice(0, 5).map(([id, count]) => ({
    org_id: id, org_name: (orgMap.get(id) as string) || id, value: `${count} acoes`
  }))
  const leastActive = [...sortedActivity].reverse().slice(0, 5).map(([id, count]) => ({
    org_id: id, org_name: (orgMap.get(id) as string) || id, value: `${count} acoes`
  }))

  return (
    <PlatformDashboardClient
      initialStats={stats}
      initialOrgs={recentOrgs}
      initialMostLoyal={mostLoyal}
      initialOldest={oldest}
      initialMostDelayed={mostDelayed}
      initialMostActive={mostActive}
      initialLeastActive={leastActive}
    />
  )
}
