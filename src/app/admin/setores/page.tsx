import { requireAdmin } from '@/lib/server-auth'
import SetoresPageClient from './SetoresPageClient'

export default async function SetoresPage() {
  const { supabase } = await requireAdmin()

  // Fetch stores
  const { data: storesData } = await supabase
    .from('stores')
    .select('*')
    .order('name')

  // Fetch sectors with store info and stats
  const { data: sectorsData } = await supabase
    .from('sectors')
    .select('*, store:stores(*)')
    .order('name')

  const sectorsWithStats = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sectorsData ?? []).map(async (sector: any) => {
      const { count: userCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('sector_id', sector.id)
      const { count: templateCount } = await supabase
        .from('template_visibility')
        .select('id', { count: 'exact', head: true })
        .eq('sector_id', sector.id)
      return { ...sector, user_count: userCount || 0, template_count: templateCount || 0 }
    })
  )

  // Fetch all active users for assignment
  const { data: usersData } = await supabase
    .from('users')
    .select('id, email, full_name, is_active')
    .eq('is_active', true)
    .order('full_name')

  return (
    <SetoresPageClient
      initialSectors={sectorsWithStats}
      initialStores={storesData ?? []}
      initialUsers={usersData ?? []}
    />
  )
}
