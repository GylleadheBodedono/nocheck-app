import { requireAdmin } from '@/lib/server-auth'
import FuncoesPageClient from './FuncoesPageClient'

export default async function FuncoesPage() {
  const { supabase } = await requireAdmin()

  // Fetch functions ordered by name
  const { data: functionsData } = await supabase
    .from('functions')
    .select('*')
    .order('name')

  // Get user counts per function
  const functionsWithStats = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (functionsData ?? []).map(async (fn: any) => {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('function_id', fn.id)
      return { ...fn, user_count: count || 0 }
    })
  )

  return <FuncoesPageClient initialFunctions={functionsWithStats} />
}
