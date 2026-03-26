'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { FiUser, FiMail, FiTrash2, FiPlus, FiShield, FiClock } from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, PageContainer } from '@/components/ui'
import {
  getMembers,
  updateMemberRole,
  removeMember,
  createInvite,
  getPendingInvites,
} from '@/services/tenant.service'
import type { OrgRole, OrganizationMember, Invite } from '@/types/tenant'

// --- Types ---

type MemberWithProfile = OrganizationMember & {
  full_name: string
  email: string
}

type Toast = {
  type: 'success' | 'error'
  message: string
}

// --- Role config ---

const ROLES: { value: OrgRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Membro' },
  { value: 'viewer', label: 'Viewer' },
]

const ROLE_BADGE_CLASSES: Record<OrgRole, string> = {
  owner: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  admin: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  manager: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  member: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
  viewer: 'bg-gray-500/15 text-gray-500 dark:text-gray-400',
}

function RoleBadge({ role }: { role: OrgRole }) {
  const label = ROLES.find((r) => r.value === role)?.label ?? role
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE_CLASSES[role]}`}
    >
      <FiShield className="w-3 h-3" />
      {label}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// --- Page Component ---

export default function EquipePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // State
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberWithProfile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [toast, setToast] = useState<Toast | null>(null)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('member')
  const [sendingInvite, setSendingInvite] = useState(false)

  // Loading states for individual actions
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null)

  // --- Toast helper ---
  const showToast = useCallback((type: Toast['type'], message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // --- Data fetching ---

  const loadData = useCallback(
    async (organizationId: string) => {
      try {
        // Fetch members and invites in parallel
        const [membersData, invitesData] = await Promise.all([
          getMembers(organizationId),
          getPendingInvites(organizationId),
        ])

        // Enrich members with user profile (name + email)
        if (membersData.length > 0) {
          const userIds = membersData.map((m) => m.user_id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profiles } = await (supabase as any)
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds)

          const profileMap = new Map<string, { full_name: string; email: string }>()
          if (profiles) {
            for (const p of profiles) {
              profileMap.set(p.id, {
                full_name: p.full_name || '',
                email: p.email || '',
              })
            }
          }

          const enriched: MemberWithProfile[] = membersData.map((m) => {
            const profile = profileMap.get(m.user_id)
            return {
              ...m,
              full_name: profile?.full_name || m.invited_email || 'Usuário',
              email: profile?.email || m.invited_email || '',
            }
          })

          setMembers(enriched)
        } else {
          setMembers([])
        }

        setInvites(invitesData)
      } catch (err) {
        console.error('[Equipe] Erro ao carregar dados:', err)
        showToast('error', 'Erro ao carregar dados da equipe')
      }
    },
    [supabase, showToast]
  )

  // --- Init ---

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          router.push(APP_CONFIG.routes.login)
          return
        }

        setCurrentUserId(user.id)

        // Get org_id from app_metadata (set by custom_access_token_hook)
        let organizationId = user.app_metadata?.org_id as string | undefined

        // Fallback: query organization_members to find org
        if (!organizationId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: membership } = await (supabase as any)
            .from('organization_members')
            .select('organization_id, role')
            .eq('user_id', user.id)
            .single()

          if (membership) {
            organizationId = membership.organization_id
          }
        }

        if (!organizationId) {
          showToast('error', 'Organização não encontrada')
          setLoading(false)
          return
        }

        // Check permission: must be owner or admin
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: myMembership } = await (supabase as any)
          .from('organization_members')
          .select('role')
          .eq('organization_id', organizationId)
          .eq('user_id', user.id)
          .single()

        const myRole = myMembership?.role as OrgRole | undefined
        if (myRole !== 'owner' && myRole !== 'admin') {
          // Also check legacy is_admin flag
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile } = await (supabase as any)
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single()

          const isLegacyAdmin = profile?.is_admin === true
          if (!isLegacyAdmin) {
            router.push(APP_CONFIG.routes.dashboard)
            return
          }
        }

        setOrgId(organizationId)
        await loadData(organizationId)
      } catch (err) {
        console.error('[Equipe] Init error:', err)
        showToast('error', 'Erro ao inicializar página')
      }

      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Actions ---

  const handleRoleChange = useCallback(
    async (memberId: string, newRole: OrgRole) => {
      if (!orgId) return
      setUpdatingRoleId(memberId)

      try {
        await updateMemberRole(memberId, newRole)
        showToast('success', 'Role atualizado com sucesso')
        await loadData(orgId)
      } catch (err) {
        console.error('[Equipe] Erro ao atualizar role:', err)
        showToast('error', 'Erro ao atualizar role')
      } finally {
        setUpdatingRoleId(null)
      }
    },
    [orgId, loadData, showToast]
  )

  const handleRemoveMember = useCallback(
    async (member: MemberWithProfile) => {
      if (!orgId) return
      if (!confirm(`Remover ${member.full_name || member.email} da equipe?`)) return

      setRemovingId(member.id)

      try {
        await removeMember(member.id)
        showToast('success', 'Membro removido com sucesso')
        await loadData(orgId)
      } catch (err) {
        console.error('[Equipe] Erro ao remover membro:', err)
        showToast('error', 'Erro ao remover membro')
      } finally {
        setRemovingId(null)
      }
    },
    [orgId, loadData, showToast]
  )

  const handleSendInvite = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!orgId || !currentUserId || !inviteEmail.trim()) return

      setSendingInvite(true)

      try {
        await createInvite(orgId, inviteEmail.trim().toLowerCase(), inviteRole, currentUserId)
        showToast('success', `Convite enviado para ${inviteEmail}`)
        setInviteEmail('')
        setInviteRole('member')
        await loadData(orgId)
      } catch (err) {
        console.error('[Equipe] Erro ao enviar convite:', err)
        const message =
          err instanceof Error && err.message.includes('duplicate')
            ? 'Já existe um convite pendente para este email'
            : 'Erro ao enviar convite'
        showToast('error', message)
      } finally {
        setSendingInvite(false)
      }
    },
    [orgId, currentUserId, inviteEmail, inviteRole, loadData, showToast]
  )

  const handleDeleteInvite = useCallback(
    async (invite: Invite) => {
      if (!orgId) return
      if (!confirm(`Cancelar convite para ${invite.email}?`)) return

      setDeletingInviteId(invite.id)

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('invites')
          .delete()
          .eq('id', invite.id)

        if (error) throw error

        showToast('success', 'Convite cancelado')
        await loadData(orgId)
      } catch (err) {
        console.error('[Equipe] Erro ao cancelar convite:', err)
        showToast('error', 'Erro ao cancelar convite')
      } finally {
        setDeletingInviteId(null)
      }
    },
    [orgId, supabase, loadData, showToast]
  )

  // --- Render ---

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-page">
      <PageContainer size="md" className="space-y-6">
        {/* Toast */}
        {toast && (
          <div
            className={`p-4 rounded-xl border ${
              toast.type === 'success'
                ? 'bg-success/10 border-success/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <p
              className={`text-sm ${
                toast.type === 'success' ? 'text-success' : 'text-red-500'
              }`}
            >
              {toast.message}
            </p>
          </div>
        )}

        {/* ── Membros ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-subtle">
            <h2 className="text-base font-semibold text-main">Membros</h2>
            <p className="text-sm text-muted mt-0.5">
              Gerencie os membros da sua organização
            </p>
          </div>

          {members.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <FiUser className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum membro encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {members.map((member) => {
                const isSelf = member.user_id === currentUserId
                const isOwner = member.role === 'owner'
                const isUpdating = updatingRoleId === member.id
                const isRemoving = removingId === member.id

                return (
                  <div
                    key={member.id}
                    className="p-4 sm:p-5 hover:bg-surface-hover/50 transition-colors"
                  >
                    {/* Desktop layout */}
                    <div className="flex items-center justify-between gap-4">
                      {/* Avatar + Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <FiUser className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-main text-sm truncate">
                              {member.full_name}
                            </p>
                            {isSelf && (
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                você
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted truncate">{member.email}</p>
                          <p className="text-xs text-muted mt-0.5 sm:hidden">
                            <FiClock className="w-3 h-3 inline mr-1" />
                            {formatDate(member.accepted_at || member.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Joined date - desktop only */}
                      <div className="hidden sm:block text-xs text-muted whitespace-nowrap">
                        <FiClock className="w-3 h-3 inline mr-1" />
                        {formatDate(member.accepted_at || member.created_at)}
                      </div>

                      {/* Role selector */}
                      <div className="shrink-0">
                        {isSelf || isOwner ? (
                          <RoleBadge role={member.role} />
                        ) : (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(member.id, e.target.value as OrgRole)
                            }
                            disabled={isUpdating}
                            className="input text-xs py-1.5 px-2 w-28 sm:w-32"
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Remove button */}
                      <div className="shrink-0">
                        {!isSelf && !isOwner ? (
                          <button
                            onClick={() => handleRemoveMember(member)}
                            disabled={isRemoving}
                            className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="Remover membro"
                          >
                            {isRemoving ? (
                              <div className="w-4 h-4 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                            ) : (
                              <FiTrash2 className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Convites Pendentes ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-subtle">
            <h2 className="text-base font-semibold text-main">Convites Pendentes</h2>
            <p className="text-sm text-muted mt-0.5">
              Convites enviados aguardando aceite
            </p>
          </div>

          {/* Invite form */}
          <form
            onSubmit={handleSendInvite}
            className="px-5 py-4 border-b border-subtle bg-surface-hover/30"
          >
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="input pl-10 text-sm"
                />
              </div>

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="input text-sm w-full sm:w-36"
              >
                {ROLES.filter((r) => r.value !== 'owner').map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={sendingInvite || !inviteEmail.trim()}
                className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {sendingInvite ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <FiPlus className="w-4 h-4" />
                    Enviar Convite
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Pending invites list */}
          {invites.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <FiMail className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum convite pendente</p>
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {invites.map((invite) => {
                const isDeleting = deletingInviteId === invite.id
                const isExpired = new Date(invite.expires_at) < new Date()

                return (
                  <div
                    key={invite.id}
                    className={`p-4 sm:p-5 transition-colors ${
                      isExpired ? 'opacity-60' : 'hover:bg-surface-hover/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Email + Role */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <FiMail className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-main text-sm truncate">
                            {invite.email}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <RoleBadge role={invite.role} />
                            {isExpired && (
                              <span className="text-[10px] font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                                expirado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expiry date */}
                      <div className="hidden sm:block text-xs text-muted whitespace-nowrap">
                        <FiClock className="w-3 h-3 inline mr-1" />
                        Expira {formatDate(invite.expires_at)}
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteInvite(invite)}
                        disabled={isDeleting}
                        className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors shrink-0"
                        title="Cancelar convite"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                        ) : (
                          <FiTrash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Mobile expiry */}
                    <p className="text-xs text-muted mt-2 sm:hidden">
                      <FiClock className="w-3 h-3 inline mr-1" />
                      Expira {formatDate(invite.expires_at)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
