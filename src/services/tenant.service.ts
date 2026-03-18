// ============================================
// SERVICE — Tenant (Organizacoes, Membros, Convites)
// ============================================
// CRUD para gerenciamento de organizacoes multi-tenant.
// Todas as queries respeitam RLS — o Supabase filtra
// automaticamente pelo tenant_id do usuario autenticado.
//
// Para queries de Superadmin que precisam ver TODOS os tenants,
// usar o service role client (ver api-auth.ts).
// ============================================

import { createClient } from '@/lib/supabase'
import type {
  Organization,
  OrganizationMember,
  Invite,
  OrgRole,
  OrgSettings,
} from '@/types/tenant'

// Helper: cria cliente Supabase (usa sessao do usuario logado)
function getClient() {
  return createClient()
}

// ── Organizacao ──

/** Busca a organizacao pelo ID */
export async function getOrganization(orgId: string): Promise<Organization> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error) throw error
  return data as Organization
}

/** Busca a organizacao pelo slug */
export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) return null
  return data as Organization
}

/** Atualiza dados da organizacao (nome, settings) */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Pick<Organization, 'name' | 'settings'>>
): Promise<Organization> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select()
    .single()

  if (error) throw error
  return data as Organization
}

/** Atualiza configuracoes da org (merge parcial com settings existentes) */
export async function updateOrgSettings(
  orgId: string,
  settings: Partial<OrgSettings>
): Promise<Organization> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (supabase as any)
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single()

  const merged = { ...current?.settings, ...settings }
  return updateOrganization(orgId, { settings: merged as OrgSettings })
}

// ── Membros ──

/** Lista todos os membros da organizacao */
export async function getMembers(orgId: string): Promise<OrganizationMember[]> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('organization_members')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at')

  if (error) throw error
  return data as OrganizationMember[]
}

/** Atualiza o role de um membro */
export async function updateMemberRole(memberId: string, role: OrgRole): Promise<void> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)

  if (error) throw error
}

/** Remove um membro da organizacao */
export async function removeMember(memberId: string): Promise<void> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('organization_members')
    .delete()
    .eq('id', memberId)

  if (error) throw error
}

// ── Convites ──

/** Cria um convite para novo membro */
export async function createInvite(
  orgId: string,
  email: string,
  role: OrgRole,
  invitedBy: string
): Promise<Invite> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invites')
    .insert({
      tenant_id: orgId,
      email,
      role,
      invited_by: invitedBy,
    })
    .select()
    .single()

  if (error) throw error
  return data as Invite
}

/** Aceita um convite via token (vincula usuario a org) */
export async function acceptInvite(token: string, userId: string): Promise<void> {
  const supabase = getClient()

  // Buscar convite valido
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invite, error: fetchError } = await (supabase as any)
    .from('invites')
    .select('*')
    .eq('token', token)
    .is('accepted_at', null)
    .single()

  if (fetchError || !invite) throw new Error('Convite invalido ou expirado')
  if (new Date(invite.expires_at) < new Date()) throw new Error('Convite expirado')

  // Criar membership na org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberError } = await (supabase as any)
    .from('organization_members')
    .insert({
      organization_id: invite.tenant_id,
      user_id: userId,
      role: invite.role,
      invited_by: invite.invited_by,
      accepted_at: new Date().toISOString(),
    })

  if (memberError) throw memberError

  // Marcar convite como aceito
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)
}

/** Lista convites pendentes da organizacao */
export async function getPendingInvites(orgId: string): Promise<Invite[]> {
  const supabase = getClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('invites')
    .select('*')
    .eq('tenant_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Invite[]
}
