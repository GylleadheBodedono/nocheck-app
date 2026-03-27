// ============================================
// Clientes — Lista de todas as organizacoes
// ============================================

import { requirePlatformAdmin } from '@/lib/server-auth'
import ClientesPageClient from './ClientesPageClient'

export default async function ClientesPage() {
  const { user, supabase } = await requirePlatformAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data } = await sb.from('organizations').select('*').order('created_at', { ascending: false })

  // Esconder a org do superadmin
  const { data: profile } = await sb.from('users').select('tenant_id').eq('id', user.id).single()
  const adminOrgId = profile?.tenant_id
  const orgs = (data || []).filter((o: { id: string }) => o.id !== adminOrgId)

  return <ClientesPageClient initialOrgs={orgs} />
}
