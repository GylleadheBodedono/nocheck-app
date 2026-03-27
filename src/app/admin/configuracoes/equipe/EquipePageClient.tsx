'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { FiUser, FiMail, FiTrash2, FiPlus, FiShield, FiClock, FiUpload, FiCopy, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi'
import { LoadingPage, PageContainer } from '@/components/ui'
import { logError } from '@/lib/clientLogger'
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

interface EquipePageClientProps {
  currentUserId: string
  initialOrgId: string | null
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

export default function EquipePageClient({ currentUserId, initialOrgId }: EquipePageClientProps) {
  const supabase = useMemo(() => createClient(), [])

  // State
  const [loading, setLoading] = useState(true)
  const [orgId] = useState<string | null>(initialOrgId)
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

  // CSV upload
  const [csvPreview, setCsvPreview] = useState<Array<{ email: string; role: OrgRole; error?: string }> | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ created: number; skipped: number; errors: Array<{ line: number; email: string; reason: string }> } | null>(null)

  // Copy link feedback
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

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

        // Also fetch users with tenant_id matching but NOT in organization_members
        // This handles admin-created users from before the org_members fix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: tenantUsers } = await (supabase as any)
          .from('users')
          .select('id, full_name, email')
          .eq('tenant_id', organizationId)

        const memberUserIds = new Set(membersData.map((m) => m.user_id))

        // Find orphaned users (in users table with tenant_id but not in organization_members)
        const orphanedUsers = (tenantUsers || []).filter(
          (u: { id: string }) => !memberUserIds.has(u.id)
        )

        // Build profile map from all tenant users for enrichment
        const profileMap = new Map<string, { full_name: string; email: string }>()
        if (tenantUsers) {
          for (const p of tenantUsers) {
            profileMap.set(p.id, {
              full_name: p.full_name || '',
              email: p.email || '',
            })
          }
        }

        // Enrich existing members with profile data
        const enriched: MemberWithProfile[] = membersData.map((m) => {
          const profile = profileMap.get(m.user_id)
          return {
            ...m,
            full_name: profile?.full_name || m.invited_email || 'Usuário',
            email: profile?.email || m.invited_email || '',
          }
        })

        // Add orphaned users as synthetic member entries (role: member)
        for (const orphan of orphanedUsers) {
          enriched.push({
            id: `orphan-${orphan.id}`,
            organization_id: organizationId,
            user_id: orphan.id,
            role: 'member' as OrgRole,
            invited_by: null,
            invited_email: null,
            accepted_at: null,
            created_at: '',
            full_name: orphan.full_name || orphan.email || 'Usuário',
            email: orphan.email || '',
          })
        }

        setMembers(enriched)
        setInvites(invitesData)
      } catch (err) {
        logError('[Equipe] Erro ao carregar dados', { error: err instanceof Error ? err.message : String(err) })
        showToast('error', 'Erro ao carregar dados da equipe')
      }
    },
    [supabase, showToast]
  )

  // --- Init: fetch members/invites using orgId from props ---

  useEffect(() => {
    const init = async () => {
      if (!orgId) {
        showToast('error', 'Organização não encontrada')
        setLoading(false)
        return
      }

      await loadData(orgId)
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
        logError('[Equipe] Erro ao atualizar role', { error: err instanceof Error ? err.message : String(err) })
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
        logError('[Equipe] Erro ao remover membro', { error: err instanceof Error ? err.message : String(err) })
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
        // Use API route to create invite + send email
        const supabase2 = createClient()
        const { data: { session } } = await supabase2.auth.getSession()

        const res = await fetch('/api/admin/invites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({
            invites: [{ email: inviteEmail.trim().toLowerCase(), role: inviteRole }],
          }),
        })

        const result = await res.json()

        if (result.created > 0) {
          showToast('success', `Convite enviado para ${inviteEmail}`)
          setInviteEmail('')
          setInviteRole('member')
          await loadData(orgId)
        } else if (result.errors?.length > 0) {
          showToast('error', result.errors[0].reason || 'Erro ao enviar convite')
        }
      } catch (err) {
        logError('[Equipe] Erro ao enviar convite', { error: err instanceof Error ? err.message : String(err) })
        showToast('error', 'Erro ao enviar convite')
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
        logError('[Equipe] Erro ao cancelar convite', { error: err instanceof Error ? err.message : String(err) })
        showToast('error', 'Erro ao cancelar convite')
      } finally {
        setDeletingInviteId(null)
      }
    },
    [orgId, supabase, loadData, showToast]
  )

  // --- CSV handlers ---

  const handleCsvFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvResult(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length === 0) return

      const firstLine = lines[0].toLowerCase().trim()
      const hasHeader = firstLine.includes('email') || firstLine.includes('e-mail')
      const dataLines = hasHeader ? lines.slice(1) : lines

      const validRoles = ['admin', 'manager', 'member', 'viewer']
      const parsed: Array<{ email: string; role: OrgRole; error?: string }> = []
      const seen = new Set<string>()

      for (const line of dataLines) {
        const parts = line.split(/[,;]/).map((s) => s.trim().replace(/^["']|["']$/g, ''))
        const email = parts[0]?.toLowerCase()
        const rawRole = (parts[1] || 'member').toLowerCase()
        const role = (validRoles.includes(rawRole) ? rawRole : 'member') as OrgRole

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          parsed.push({ email: email || '', role, error: 'Email invalido' })
          continue
        }
        if (seen.has(email)) {
          parsed.push({ email, role, error: 'Duplicado' })
          continue
        }
        seen.add(email)
        parsed.push({ email, role })
      }

      setCsvPreview(parsed)
    }
    reader.readAsText(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const handleCsvRemoveRow = useCallback((index: number) => {
    setCsvPreview((prev) => prev ? prev.filter((_, i) => i !== index) : null)
  }, [])

  const handleCsvSubmit = useCallback(async () => {
    if (!csvPreview || !orgId) return
    const validItems = csvPreview.filter((p) => !p.error)
    if (validItems.length === 0) {
      showToast('error', 'Nenhum email valido para enviar')
      return
    }

    setCsvUploading(true)
    try {
      const supabase2 = createClient()
      const { data: { session } } = await supabase2.auth.getSession()
      const formData = new FormData()
      const csvContent = 'email,role\n' + validItems.map((i) => `${i.email},${i.role}`).join('\n')
      formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'invites.csv')

      const res = await fetch('/api/admin/invites/csv', {
        method: 'POST',
        headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {},
        body: formData,
      })
      const result = await res.json()
      setCsvResult(result)
      setCsvPreview(null)

      if (result.created > 0) {
        showToast('success', `${result.created} convite(s) enviado(s) com sucesso`)
        await loadData(orgId)
      }
    } catch (err) {
      logError('[Equipe] Erro ao enviar CSV', { error: err instanceof Error ? err.message : String(err) })
      showToast('error', 'Erro ao processar arquivo CSV')
    } finally {
      setCsvUploading(false)
    }
  }, [csvPreview, orgId, showToast, loadData])

  const handleCopyInviteLink = useCallback(async (invite: Invite) => {
    const url = `${window.location.origin}/cadastro?invite=${invite.token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedInviteId(invite.id)
      setTimeout(() => setCopiedInviteId(null), 2000)
    } catch {
      showToast('error', 'Erro ao copiar link')
    }
  }, [showToast])

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

        {/* -- Membros -- */}
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

        {/* -- Convites Pendentes -- */}
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
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                <input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="input text-sm"
                  style={{ paddingLeft: '2.5rem' }}
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

          {/* CSV Upload Section */}
          <div className="px-5 py-4 border-b border-subtle bg-surface-hover/20">
            <div className="flex items-center gap-2 mb-3">
              <FiUpload className="w-4 h-4 text-muted" />
              <p className="text-sm font-medium text-main">Importar CSV</p>
            </div>

            {!csvPreview && !csvResult && (
              <div>
                <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-subtle rounded-xl cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                  <FiUpload className="w-4 h-4 text-muted" />
                  <span className="text-sm text-muted">Clique para selecionar arquivo CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-muted mt-2">Formato: email,role (uma linha por convite). Role opcional (admin, manager, member, viewer).</p>
              </div>
            )}

            {/* CSV Preview */}
            {csvPreview && (
              <div className="space-y-3">
                <div className="max-h-48 overflow-y-auto rounded-lg border border-subtle">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-hover sticky top-0">
                      <tr>
                        <th className="text-left p-2 text-xs font-medium text-muted">Email</th>
                        <th className="text-left p-2 text-xs font-medium text-muted">Cargo</th>
                        <th className="text-center p-2 text-xs font-medium text-muted w-16">Status</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {csvPreview.map((row, i) => (
                        <tr key={i} className={row.error ? 'bg-red-500/5' : ''}>
                          <td className="p-2 text-main truncate max-w-[200px]">{row.email}</td>
                          <td className="p-2"><RoleBadge role={row.role} /></td>
                          <td className="p-2 text-center">
                            {row.error ? (
                              <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">{row.error}</span>
                            ) : (
                              <FiCheck className="w-3.5 h-3.5 text-success mx-auto" />
                            )}
                          </td>
                          <td className="p-2">
                            <button onClick={() => handleCsvRemoveRow(i)} className="p-1 text-muted hover:text-error transition-colors">
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {csvPreview.filter((r) => !r.error).length} valido(s) de {csvPreview.length}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCsvPreview(null); setCsvResult(null) }}
                      className="btn-secondary text-sm px-3 py-1.5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCsvSubmit}
                      disabled={csvUploading || csvPreview.filter((r) => !r.error).length === 0}
                      className="btn-primary text-sm px-4 py-1.5 flex items-center gap-2 disabled:opacity-50"
                    >
                      {csvUploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <FiMail className="w-3.5 h-3.5" />
                          Enviar {csvPreview.filter((r) => !r.error).length} Convite(s)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CSV Result */}
            {csvResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  {csvResult.created > 0 && (
                    <span className="flex items-center gap-1 text-success">
                      <FiCheck className="w-4 h-4" /> {csvResult.created} criado(s)
                    </span>
                  )}
                  {csvResult.skipped > 0 && (
                    <span className="flex items-center gap-1 text-amber-500">
                      <FiAlertTriangle className="w-4 h-4" /> {csvResult.skipped} ignorado(s)
                    </span>
                  )}
                  {csvResult.errors.length > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <FiX className="w-4 h-4" /> {csvResult.errors.length} erro(s)
                    </span>
                  )}
                </div>
                {csvResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs text-red-500 space-y-0.5">
                    {csvResult.errors.map((err, i) => (
                      <p key={i}>{err.email ? `${err.email}: ` : ''}{err.reason}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => setCsvResult(null)} className="text-xs text-primary hover:underline">
                  Fechar resultado
                </button>
              </div>
            )}
          </div>

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

                      {/* Copy link + Delete buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCopyInviteLink(invite)}
                          className="p-2 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="Copiar link do convite"
                        >
                          {copiedInviteId === invite.id ? (
                            <FiCheck className="w-4 h-4 text-success" />
                          ) : (
                            <FiCopy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteInvite(invite)}
                          disabled={isDeleting}
                          className="p-2 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                          title="Cancelar convite"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-error/30 border-t-error rounded-full animate-spin" />
                          ) : (
                            <FiTrash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
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
