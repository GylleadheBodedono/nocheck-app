import { requireAdmin } from '@/lib/server-auth'
import EquipePageClient from './EquipePageClient'

export default async function EquipePage() {
  const { user, supabase } = await requireAdmin()

  // Get org_id from user's app_metadata or fallback to organization_members
  const { data: { user: authUser } } = await supabase.auth.getUser()
  let orgId: string | null = (authUser?.app_metadata?.org_id as string | undefined) ?? null

  if (!orgId) {
    // organization_members is not in the typed Database schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    orgId = membership?.organization_id ?? null
  }

  return (
    <EquipePageClient
      currentUserId={user.id}
      initialOrgId={orgId}
    />
  )
}
