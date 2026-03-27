import { requireAdmin } from '@/lib/server-auth'
import PlanosDeAcaoPageClient from './PlanosDeAcaoPageClient'

export default async function PlanoDeAcaoPage() {
  const { supabase } = await requireAdmin()

  // Fetch action plans with relations (admin sees all)
  const { data: plansData } = await supabase
    .from('action_plans')
    .select(`*, store:stores(name), assigned_function:functions(name), field:template_fields(name), template:checklist_templates(name), action_plan_stores(store_id, store:stores(name))`)
    .order('created_at', { ascending: false })

  // Fetch assignee names separately (the original query does not use a FK join for assigned_user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let plansWithUsers: any[] = plansData ?? []
  if (plansData && plansData.length > 0) {
    const assigneeIds = [...new Set(
      plansData
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => p.assigned_to)
        .filter(Boolean)
    )]
    let usersMap = new Map<string, string>()
    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', assigneeIds)
      if (assignees) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usersMap = new Map(assignees.map((u: any) => [u.id, u.full_name]))
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plansWithUsers = plansData.map((p: any) => ({
      ...p,
      assigned_user: usersMap.get(p.assigned_to) ? { full_name: usersMap.get(p.assigned_to) } : null,
    }))
  }

  // Fetch filter options
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)
    .order('name')

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name')

  return (
    <PlanosDeAcaoPageClient
      initialActionPlans={plansWithUsers}
      initialStores={stores ?? []}
      initialUsers={users ?? []}
    />
  )
}
