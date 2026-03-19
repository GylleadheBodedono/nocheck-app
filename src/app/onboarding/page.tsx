'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { updateOrganization, createInvite } from '@/services/tenant.service'
import type { OrgRole } from '@/types/tenant'
import { FiCheck, FiPlus, FiTrash2, FiArrowRight, FiLoader } from 'react-icons/fi'

// ── Types ──

type PendingInvite = {
  email: string
  role: OrgRole
}

// ── Constants ──

const STEPS = [
  { number: 1, title: 'Organização' },
  { number: 2, title: 'Loja' },
  { number: 3, title: 'Equipe' },
]

const INVITABLE_ROLES: { value: OrgRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Gerente' },
  { value: 'member', label: 'Membro' },
]

// ============================================
// ONBOARDING WIZARD
// ============================================

export default function OnboardingPage() {
  // ── Auth & Org State ──
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Wizard State ──
  const [currentStep, setCurrentStep] = useState(1)
  const [transitioning, setTransitioning] = useState(false)

  // ── Step 1: Org Name ──
  const [orgName, setOrgName] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  // ── Step 2: Store ──
  const [storeName, setStoreName] = useState('')
  const [storeAddress, setStoreAddress] = useState('')
  const [savingStore, setSavingStore] = useState(false)

  // ── Step 3: Invites ──
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<OrgRole>('member')
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [finishing, setFinishing] = useState(false)

  // ── Load session & org on mount ──
  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user) {
          window.location.href = APP_CONFIG.routes.login
          return
        }

        setUserId(session.user.id)

        // Find the user's org via organization_members
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: membership, error: memberError } = await (supabase as any)
          .from('organization_members')
          .select('organization_id, organizations:organization_id(id, name)')
          .eq('user_id', session.user.id)
          .limit(1)
          .single()

        if (memberError || !membership) {
          setError('Não foi possível encontrar sua organização. Entre em contato com o suporte.')
          setLoading(false)
          return
        }

        const org = membership.organizations as { id: string; name: string } | null
        if (org) {
          setOrgId(org.id)
          setOrgName(org.name || '')
        } else {
          setOrgId(membership.organization_id)
        }
      } catch (err) {
        console.error('[Onboarding] Erro ao inicializar:', err)
        setError('Erro ao carregar dados. Tente recarregar a página.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  // ── Step Navigation ──
  const goToStep = useCallback((step: number) => {
    setTransitioning(true)
    setError(null)
    setTimeout(() => {
      setCurrentStep(step)
      setTransitioning(false)
    }, 200)
  }, [])

  // ── Step 1: Save Org Name ──
  const handleSaveOrgName = async () => {
    if (!orgId || !orgName.trim()) return
    setSavingOrg(true)
    setError(null)

    try {
      await updateOrganization(orgId, { name: orgName.trim() })
      goToStep(2)
    } catch (err) {
      console.error('[Onboarding] Erro ao salvar organizacao:', err)
      setError('Erro ao salvar o nome da organização. Tente novamente.')
    } finally {
      setSavingOrg(false)
    }
  }

  // ── Step 2: Create Store ──
  const handleCreateStore = async () => {
    if (!orgId || !storeName.trim()) return
    setSavingStore(true)
    setError(null)

    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase as any)
        .from('stores')
        .insert({
          tenant_id: orgId,
          name: storeName.trim(),
          address: storeAddress.trim() || null,
        })

      if (insertError) throw insertError
      goToStep(3)
    } catch (err) {
      console.error('[Onboarding] Erro ao criar loja:', err)
      setError('Erro ao criar a loja. Tente novamente.')
    } finally {
      setSavingStore(false)
    }
  }

  const handleSkipStore = () => {
    goToStep(3)
  }

  // ── Step 3: Invite Management ──
  const handleAddInvite = () => {
    const trimmedEmail = inviteEmail.trim().toLowerCase()
    if (!trimmedEmail) return

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Email inválido. Verifique e tente novamente.')
      return
    }

    // Check duplicates
    if (pendingInvites.some((inv) => inv.email === trimmedEmail)) {
      setError('Este email já foi adicionado.')
      return
    }

    setError(null)
    setPendingInvites((prev) => [...prev, { email: trimmedEmail, role: inviteRole }])
    setInviteEmail('')
    setInviteRole('member')
  }

  const handleRemoveInvite = (email: string) => {
    setPendingInvites((prev) => prev.filter((inv) => inv.email !== email))
  }

  const handleFinish = async () => {
    if (!orgId || !userId) return
    setFinishing(true)
    setError(null)

    try {
      // Send all pending invites
      for (const invite of pendingInvites) {
        await createInvite(orgId, invite.email, invite.role, userId)
      }

      window.location.href = '/dashboard'
    } catch (err) {
      console.error('[Onboarding] Erro ao enviar convites:', err)
      setError('Erro ao enviar convites. Tente novamente.')
      setFinishing(false)
    }
  }

  // ── Loading State ──
  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">{APP_CONFIG.messages.loading}</p>
        </div>
      </div>
    )
  }

  // ── Progress ──
  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-8">
      {/* Container */}
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-secondary">Opere</span>
            <span className="text-primary">Check</span>
          </h1>
          <p className="text-muted text-sm mt-2">Configure sua conta em poucos passos</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-4">
          {STEPS.map((step) => (
            <div key={step.number} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-all duration-300
                    ${
                      currentStep > step.number
                        ? 'bg-primary text-primary-foreground'
                        : currentStep === step.number
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'bg-surface border border-[var(--border-default)] text-muted'
                    }
                  `}
                >
                  {currentStep > step.number ? (
                    <FiCheck className="w-4 h-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`text-xs mt-1.5 transition-colors duration-300 ${
                    currentStep >= step.number ? 'text-primary font-medium' : 'text-muted'
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {step.number < STEPS.length && (
                <div
                  className={`w-12 h-px mb-5 transition-colors duration-300 ${
                    currentStep > step.number
                      ? 'bg-[var(--primary)]'
                      : 'bg-[var(--border-subtle)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-surface-hover rounded-full mb-8 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Card Container */}
        <div
          className={`card p-8 transition-opacity duration-200 ${
            transitioning ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* ── Step 1: Organization Name ── */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-semibold text-main mb-2">
                Nome da Organização
              </h2>
              <p className="text-muted text-sm mb-6">
                Como sua empresa ou operação se chama? Você pode alterar depois.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="orgName"
                    className="block text-sm font-medium text-secondary mb-2"
                  >
                    Nome da organização
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex: Restaurante Sabor & Arte"
                    className="input"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-error rounded-xl border border-[var(--status-error-border)]">
                    <p className="text-error text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleSaveOrgName}
                  disabled={!orgName.trim() || savingOrg}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  {savingOrg ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      Continuar
                      <FiArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Create First Store ── */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-semibold text-main mb-2">
                Criar Primeira Loja
              </h2>
              <p className="text-muted text-sm mb-6">
                Cadastre sua primeira unidade. Você pode adicionar mais depois.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="storeName"
                    className="block text-sm font-medium text-secondary mb-2"
                  >
                    Nome da loja
                  </label>
                  <input
                    id="storeName"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Unidade Centro"
                    className="input"
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="storeAddress"
                    className="block text-sm font-medium text-secondary mb-2"
                  >
                    Endereço <span className="text-muted font-normal">(opcional)</span>
                  </label>
                  <input
                    id="storeAddress"
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="Ex: Rua das Flores, 123 - Centro"
                    className="input"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-error rounded-xl border border-[var(--status-error-border)]">
                    <p className="text-error text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleCreateStore}
                  disabled={!storeName.trim() || savingStore}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  {savingStore ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Criando loja...
                    </>
                  ) : (
                    <>
                      Continuar
                      <FiArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  onClick={handleSkipStore}
                  disabled={savingStore}
                  className="btn-ghost w-full py-2.5 text-sm"
                >
                  Pular por enquanto
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Invite Members ── */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-semibold text-main mb-2">
                Convidar Membros
              </h2>
              <p className="text-muted text-sm mb-6">
                Adicione sua equipe. Eles receberão um convite por email.
              </p>

              <div className="space-y-4">
                {/* Invite Form Row */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value)
                        setError(null)
                      }}
                      placeholder="email@exemplo.com"
                      className="input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddInvite()
                        }
                      }}
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    className="input sm:w-36"
                  >
                    {INVITABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddInvite}
                    disabled={!inviteEmail.trim()}
                    className="btn-secondary py-2.5 px-4 flex items-center justify-center gap-1.5 text-sm font-medium"
                  >
                    <FiPlus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-error rounded-xl border border-[var(--status-error-border)]">
                    <p className="text-error text-sm">{error}</p>
                  </div>
                )}

                {/* Pending Invites List */}
                {pendingInvites.length > 0 && (
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-surface-hover">
                      <p className="text-xs font-medium text-muted uppercase tracking-wider">
                        Convites pendentes ({pendingInvites.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {pendingInvites.map((invite) => (
                        <li
                          key={invite.email}
                          className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-main truncate">
                              {invite.email}
                            </p>
                            <p className="text-xs text-muted capitalize">
                              {INVITABLE_ROLES.find((r) => r.value === invite.role)?.label || invite.role}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveInvite(invite.email)}
                            className="ml-3 p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors"
                            aria-label={`Remover convite de ${invite.email}`}
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Finish Button */}
                <button
                  onClick={handleFinish}
                  disabled={finishing}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold"
                >
                  {finishing ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      {pendingInvites.length > 0 ? 'Enviando convites...' : 'Finalizando...'}
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      {pendingInvites.length > 0
                        ? `Finalizar e enviar ${pendingInvites.length} convite${pendingInvites.length > 1 ? 's' : ''}`
                        : 'Finalizar configuração'}
                    </>
                  )}
                </button>

                {pendingInvites.length === 0 && (
                  <p className="text-xs text-muted text-center">
                    Você pode convidar membros depois em Configurações.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-muted text-xs mt-8">
          {APP_CONFIG.company} &middot; {APP_CONFIG.year}
        </p>
      </div>
    </div>
  )
}
