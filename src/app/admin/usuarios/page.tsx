import { requireAdmin } from '@/lib/server-auth'
import UsuariosPageClient from './UsuariosPageClient'

export default async function UsuariosPage() {
  const { user, supabase } = await requireAdmin()

  // Fetch users with relations
  const { data: usersData } = await supabase
    .from('users')
    .select(`
      *,
      store:stores(*),
      function_ref:functions(*),
      sector:sectors(*),
      user_stores(*, store:stores(*), sector:sectors(*))
    `)
    .order('full_name')

  // Fetch favorites
  const { data: favorites } = await supabase
    .from('admin_favorites')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_type', 'user')

  return (
    <UsuariosPageClient
      initialUsers={usersData ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialFavoriteIds={(favorites ?? []).map((f: any) => f.entity_id)}
      currentUserId={user.id}
    />
  )
}
