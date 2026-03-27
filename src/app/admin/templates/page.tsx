import { requireAdmin } from '@/lib/server-auth'
import TemplatesPageClient from './TemplatesPageClient'

export default async function TemplatesPage() {
  const { user, supabase } = await requireAdmin()

  const { data: templates } = await supabase
    .from('checklist_templates')
    .select(`
      *,
      fields:template_fields(*),
      visibility:template_visibility(
        *,
        store:stores(*)
      )
    `)
    .order('created_at', { ascending: false })

  const { data: favorites } = await supabase
    .from('admin_favorites')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_type', 'template')

  return (
    <TemplatesPageClient
      initialTemplates={templates ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialFavoriteIds={(favorites ?? []).map((f: any) => Number(f.entity_id))}
      currentUserId={user.id}
    />
  )
}
