// ============================================
// Detalhe do Cliente — Gerenciar organizacao
// ============================================

import { redirect } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/server-auth'
import ClienteDetailClient from './ClienteDetailClient'

export default async function ClienteDetailPage({ params }: { params: { orgId: string } }) {
  const { supabase } = await requirePlatformAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any

  const { data: orgData } = await sb.from('organizations').select('*').eq('id', params.orgId).single()
  if (!orgData) redirect('/platform/clientes')

  // Fetch members with user details
  const { data: memberData } = await sb.from('organization_members').select('*').eq('organization_id', params.orgId)
  let members: { id: string; user_id: string; role: string; accepted_at: string | null; email?: string; full_name?: string }[] = []
  if (memberData && memberData.length > 0) {
    const userIds = memberData.map((m: { user_id: string }) => m.user_id)
    const { data: users } = await sb.from('users').select('id, email, full_name').in('id', userIds)
    const userMap = new Map((users || []).map((u: { id: string; email: string; full_name: string }) => [u.id, u]))
    members = memberData.map((m: { id: string; user_id: string; role: string; accepted_at: string | null }) => ({
      ...m,
      email: (userMap.get(m.user_id) as { email?: string } | undefined)?.email || '',
      full_name: (userMap.get(m.user_id) as { full_name?: string } | undefined)?.full_name || '',
    }))
  }

  // Counts
  const { count: storeCount } = await sb.from('stores').select('id', { count: 'exact', head: true }).eq('tenant_id', params.orgId)
  const { count: checklistCount } = await sb.from('checklists').select('id', { count: 'exact', head: true }).eq('tenant_id', params.orgId)

  return (
    <ClienteDetailClient
      initialOrg={orgData}
      initialMembers={members}
      initialStoreCount={storeCount || 0}
      initialChecklistCount={checklistCount || 0}
    />
  )
}
