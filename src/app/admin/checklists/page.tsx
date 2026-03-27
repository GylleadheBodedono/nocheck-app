import { requireAdmin } from '@/lib/server-auth'
import ChecklistsPageClient from './ChecklistsPageClient'

/**
 * Server component for the admin checklists page (`/admin/checklists`).
 * Authenticates admin, fetches initial data server-side, then delegates
 * rendering and interactivity to ChecklistsPageClient.
 */
export default async function AdminChecklistsPage() {
  const { supabase } = await requireAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  // Fetch checklists with relations
  const { data: checklistsRaw } = await sb
    .from('checklists')
    .select(`
      id, status, created_at, completed_at, created_by,
      template:checklist_templates(*),
      store:stores(*)
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fetch filter options
  const { data: stores } = await supabase.from('stores').select('*').order('name')
  const { data: templates } = await supabase.from('checklist_templates').select('*').order('name')
  const { data: users } = await sb.from('users').select('id, email, full_name').order('full_name')

  // Map users onto checklists (users table can't be joined directly in all configs)
  const usersMap = new Map((users ?? []).map((u: { id: string }) => [u.id, u]))
  const checklists = (checklistsRaw ?? []).map((c: { created_by: string; [key: string]: unknown }) => ({
    ...c,
    user: usersMap.get(c.created_by) || { id: c.created_by, email: 'Desconhecido', full_name: 'Usuário Desconhecido' },
  }))

  return (
    <ChecklistsPageClient
      initialChecklists={checklists}
      initialStores={stores ?? []}
      initialTemplates={templates ?? []}
      initialUsers={users ?? []}
    />
  )
}
