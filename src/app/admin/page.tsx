import { requireAdmin } from '@/lib/server-auth'
import AdminDashboardClient from './AdminDashboardClient'

/**
 * Dashboard admin (`/admin`) — Server Component.
 * Fetches all KPI stats, preview data, and settings server-side,
 * then passes them to the client component for rendering.
 */
export default async function AdminPage() {
  const { supabase } = await requireAdmin()

  // Fetch stats + preview data in parallel
  const [
    usersRes, templatesRes, storesRes, sectorsRes, functionsRes, checklistsRes, validationsRes,
    recentUsersRes, recentTemplatesRes, recentStoresRes, recentSectorsRes, recentFunctionsRes, recentChecklistsRes, recentValidationsRes,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('sectors').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('functions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('checklists').select('id', { count: 'exact', head: true }),
    supabase.from('cross_validations').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    // Preview data for cards
    supabase.from('users').select('id, full_name, email, is_active, created_at').order('created_at', { ascending: false }).limit(3),
    supabase.from('checklist_templates').select('id, name, category, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('stores').select('id, name, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('sectors').select('id, name, color, is_active, store:stores(name)').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('functions').select('id, name, color, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
    supabase.from('checklists').select('id, status, created_at, template:checklist_templates(name), store:stores(name), user:users(full_name)').order('created_at', { ascending: false }).limit(3),
    supabase.from('cross_validations').select('id, status, numero_nota, created_at, store:stores(name)').eq('status', 'pendente').order('created_at', { ascending: false }).limit(3),
  ])

  // Checklists today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const { count: checklistsTodayCount } = await supabase
    .from('checklists')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  const stats = {
    totalUsers: usersRes.count || 0,
    totalTemplates: templatesRes.count || 0,
    totalStores: storesRes.count || 0,
    totalSectors: sectorsRes.count || 0,
    totalFunctions: functionsRes.count || 0,
    totalChecklists: checklistsRes.count || 0,
    checklistsToday: checklistsTodayCount || 0,
    pendingValidations: validationsRes.count || 0,
  }

  const preview = {
    recentUsers: recentUsersRes.data || [],
    recentTemplates: recentTemplatesRes.data || [],
    recentStores: recentStoresRes.data || [],
    recentSectors: recentSectorsRes.data || [],
    recentFunctions: recentFunctionsRes.data || [],
    recentChecklists: recentChecklistsRes.data || [],
    recentValidations: recentValidationsRes.data || [],
  }

  // Fetch stores list for time restriction config
  const { data: allStoresList } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  // Fetch time restriction settings directly from app_settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingsRows } = await (supabase as any)
    .from('app_settings')
    .select('key, value')
    .or('key.eq.ignore_time_restrictions,key.eq.ignore_time_restrictions_stores') as { data: { key: string; value: string }[] | null }

  let initialIgnoreTimeRestrictions = false
  let initialBypassStoreIds: number[] | 'all' = 'all'

  if (settingsRows) {
    const toggleVal = settingsRows.find(s => s.key === 'ignore_time_restrictions')?.value
    const storesVal = settingsRows.find(s => s.key === 'ignore_time_restrictions_stores')?.value
    initialIgnoreTimeRestrictions = toggleVal === 'true'
    if (storesVal && storesVal !== 'all') {
      try { initialBypassStoreIds = JSON.parse(storesVal) } catch { initialBypassStoreIds = 'all' }
    } else {
      initialBypassStoreIds = 'all'
    }
  }

  return (
    <AdminDashboardClient
      initialStats={stats}
      initialPreview={preview}
      initialAllStores={allStoresList ?? []}
      initialIgnoreTimeRestrictions={initialIgnoreTimeRestrictions}
      initialBypassStoreIds={initialBypassStoreIds}
    />
  )
}
