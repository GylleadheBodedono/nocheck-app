// ============================================
// Billing — Página de assinatura e upgrade
// ============================================

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FiCheck, FiArrowLeft, FiCreditCard, FiStar, FiZap, FiShield, FiFileText, FiExternalLink } from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { PLAN_CONFIGS, type Plan, type PlanConfig } from '@/types/tenant'
import { fetchPlanConfigs } from '@/lib/plans'
import { createPortalSession, getTrialDaysRemaining } from '@/services/billing.service'
import { LoadingPage } from '@/components/ui'
import { logError } from '@/lib/clientLogger'
import { PaymentModal } from '@/components/billing/PaymentModal'
import { DowngradeModal } from '@/components/billing/DowngradeModal'

type OrgBilling = {
  id: string; name: string; plan: Plan; stripe_customer_id: string | null
  stripe_subscription_id: string | null; trial_ends_at: string | null; features: string[]
  max_users: number; max_stores: number
  pending_plan: string | null; previous_plan: string | null; current_period_end: string | null; cancel_at_period_end: boolean
}

type UsageStats = {
  currentUsers: number
  currentStores: number
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial (Grátis)', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
}

export default function BillingPage() {
  const [org, setOrg] = useState<OrgBilling | null>(null)
  const [usage, setUsage] = useState<UsageStats>({ currentUsers: 0, currentStores: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [downgradePlan, setDowngradePlan] = useState<Plan | null>(null)
  const [planConfigs, setPlanConfigs] = useState<Record<string, PlanConfig>>(PLAN_CONFIGS)
  const [billingTab, setBillingTab] = useState<'plan' | 'invoices' | 'payment'>('plan')
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string | null; amount: number; currency: string; status: string | null; created: number; dueDate: number | null; paidAt: number | null; hostedUrl: string | null; pdfUrl: string | null }>>([])
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }>>([])
  const [loadingBilling, setLoadingBilling] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const billingStatus = searchParams.get('billing')

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    // Usar RPC com SECURITY DEFINER para garantir acesso ao tenant_id real
    const tenantRes = await sb.rpc('get_my_tenant_id')
    const orgId = tenantRes.data || user.app_metadata?.org_id
    if (!orgId) { setLoading(false); return }

    const orgRes = await sb.rpc('get_org_billing', { p_org_id: orgId })

    if (orgRes.data && orgRes.data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = orgRes.data[0] as any
      setOrg({
        ...raw,
        pending_plan: raw.pending_plan ?? null,
        previous_plan: raw.previous_plan ?? null,
        current_period_end: raw.current_period_end ?? null,
        cancel_at_period_end: raw.cancel_at_period_end ?? false,
      } as OrgBilling)
      // Contagens vem do RPC (SECURITY DEFINER, bypassa RLS)
      setUsage({
        currentUsers: Number(raw.current_users) || 0,
        currentStores: Number(raw.current_stores) || 0,
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    fetchPlanConfigs().then(setPlanConfigs)
  }, [supabase, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePortal = async () => {
    if (!org) return
    try {
      const { url } = await createPortalSession({ orgId: org.id })
      if (url) window.location.href = url
    } catch (err) {
      logError('[Billing] Erro portal', { error: err instanceof Error ? err.message : String(err) })
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      alert(`Não foi possível abrir o gerenciamento de assinatura: ${msg}`)
    }
  }

  const handlePaymentSuccess = () => {
    window.location.reload()
  }

  // Carregar faturas e cartoes quando mudar para aba de faturas/pagamento
  const loadBillingDetails = async () => {
    if (!org?.id || loadingBilling) return
    setLoadingBilling(true)
    try {
      const res = await fetch(`/api/billing/invoices?orgId=${org.id}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setPaymentMethods(data.paymentMethods || [])
      }
    } catch { /* silenciar */ }
    setLoadingBilling(false)
  }

  // Upgrade via change-plan API (para quem ja tem subscription — sem pedir cartao)
  const [upgrading, setUpgrading] = useState(false)
  const handleUpgradeViaApi = async (newPlan: string) => {
    if (!org) return
    setUpgrading(true)
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, newPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Erro ao mudar plano')
        setUpgrading(false)
        return
      }
      window.location.reload()
    } catch {
      alert('Erro de conexao')
      setUpgrading(false)
    }
  }

  if (loading) return <LoadingPage />

  const trialDays = org?.trial_ends_at ? getTrialDaysRemaining(org.trial_ends_at) : 0
  const currentPlan = (org?.plan || 'trial') as Plan
  // Debug removido em producao

  const featureLabels: Record<string, string> = {
    basic_orders: 'Checklists ilimitados',
    basic_reports: 'Relatórios básicos',
    cancellations: 'Gestão de não-conformidades',
    kpi_dashboard: 'Painel de indicadores (KPI)',
    bi_dashboard: 'Dashboard avançado de BI',
    export_excel: 'Exportar para Excel',
    export_pdf: 'Exportar para PDF',
    integrations_ifood: 'Integração com iFood',
    integrations_teknisa: 'Integração com Teknisa',
    white_label: 'Sua marca personalizada',
    api_access: 'Acesso a API',
    custom_domain: 'Domínio personalizado',
    audit_logs: 'Registro de auditoria',
    advanced_analytics: 'Análises avançadas',
  }

  const planIcons: Record<string, React.ReactNode> = {
    trial: <FiZap className="w-5 h-5" />,
    starter: <FiStar className="w-5 h-5" />,
    professional: <FiZap className="w-5 h-5" />,
    enterprise: <FiShield className="w-5 h-5" />,
  }

  const planOrder = ['trial', 'starter', 'professional', 'enterprise']

  return (
    <div className="min-h-screen bg-page">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={APP_CONFIG.routes.adminSettings} className="p-2 text-muted hover:text-main rounded-xl">
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-main">Assinatura</h1>
            <p className="text-sm text-muted">Gerencie seu plano e pagamentos</p>
          </div>
        </div>

        {/* Abas: Plano | Faturas | Pagamento */}
        {org?.stripe_subscription_id && (
          <div className="flex gap-1 p-1 bg-surface-hover rounded-xl w-fit mb-6">
            {[
              { key: 'plan' as const, label: 'Plano', icon: <FiZap className="w-3.5 h-3.5" /> },
              { key: 'invoices' as const, label: 'Faturas', icon: <FiFileText className="w-3.5 h-3.5" /> },
              { key: 'payment' as const, label: 'Pagamento', icon: <FiCreditCard className="w-3.5 h-3.5" /> },
            ].map(tab => (
              <button key={tab.key}
                onClick={() => { setBillingTab(tab.key); if (tab.key !== 'plan' && invoices.length === 0) loadBillingDetails() }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  billingTab === tab.key ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Status messages */}
        {billingStatus === 'success' && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl mb-6 text-success text-sm">
            Pagamento confirmado! Seu plano foi atualizado.
          </div>
        )}
        {billingStatus === 'cancelled' && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl mb-6 text-warning text-sm">
            Checkout cancelado. Nenhuma cobrança foi feita.
          </div>
        )}

        {/* ==================== ABA: FATURAS ==================== */}
        {billingTab === 'invoices' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-main">Historico de Faturas</h2>
            {loadingBilling ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : invoices.length === 0 ? (
              <div className="card p-8 text-center">
                <FiFileText className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted">Nenhuma fatura encontrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${inv.status === 'paid' ? 'bg-success' : inv.status === 'open' ? 'bg-warning' : 'bg-error'}`} />
                      <div>
                        <p className="text-sm font-medium text-main">{inv.number || inv.id.slice(0, 16)}</p>
                        <p className="text-xs text-muted">{new Date(inv.created * 1000).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-bold text-main">R$ {(inv.amount / 100).toFixed(2)}</p>
                        <p className={`text-[10px] font-semibold uppercase ${inv.status === 'paid' ? 'text-success' : inv.status === 'open' ? 'text-warning' : 'text-error'}`}>
                          {inv.status === 'paid' ? 'Pago' : inv.status === 'open' ? 'Pendente' : inv.status === 'draft' ? 'Rascunho' : inv.status || 'Desconhecido'}
                        </p>
                      </div>
                      {inv.hostedUrl && (
                        <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-muted hover:text-primary rounded-lg" title="Ver fatura">
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== ABA: PAGAMENTO ==================== */}
        {billingTab === 'payment' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-main">Metodos de Pagamento</h2>
            {loadingBilling ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : paymentMethods.length === 0 ? (
              <div className="card p-8 text-center">
                <FiCreditCard className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted">Nenhum cartao cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map(pm => (
                  <div key={pm.id} className={`card p-4 flex items-center justify-between ${pm.isDefault ? 'border-primary/30 border-2' : ''}`}>
                    <div className="flex items-center gap-3">
                      <FiCreditCard className="w-5 h-5 text-muted" />
                      <div>
                        <p className="text-sm font-medium text-main capitalize">{pm.brand} •••• {pm.last4}</p>
                        <p className="text-xs text-muted">Expira {String(pm.expMonth).padStart(2, '0')}/{pm.expYear}</p>
                      </div>
                    </div>
                    {pm.isDefault && (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">PRINCIPAL</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Botao para gerenciar no Stripe Portal */}
            <button onClick={handlePortal} className="btn-secondary flex items-center gap-2 text-sm">
              <FiCreditCard className="w-4 h-4" />
              Adicionar ou alterar cartao
            </button>
          </div>
        )}

        {/* ==================== ABA: PLANO ==================== */}
        {billingTab === 'plan' && (<>

        {/* Plano atual */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Plano atual</p>
              <p className="text-xl font-bold text-main capitalize">{currentPlan}</p>
              {currentPlan === 'trial' && trialDays > 0 && (
                <p className="text-sm text-warning mt-1">{trialDays} dias restantes no trial</p>
              )}
            </div>
            {org?.stripe_subscription_id && (
              <button onClick={handlePortal}
                className="flex items-center gap-2 px-4 py-2 btn-secondary rounded-xl text-sm">
                <FiCreditCard className="w-4 h-4" />
                Gerenciar Assinatura
              </button>
            )}
          </div>
        </div>

        {/* Uso atual */}
        {org && (() => {
          const planConfig = planConfigs[org.plan as Plan]
          const maxUsers = planConfig?.maxUsers || org.max_users
          const maxStores = planConfig?.maxStores || org.max_stores
          return (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Usuários</p>
              <p className="text-2xl font-bold text-main">
                {usage.currentUsers} <span className="text-base font-normal text-muted">/ {maxUsers}</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.currentUsers >= maxUsers ? 'bg-error' : usage.currentUsers >= maxUsers * 0.8 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (usage.currentUsers / maxUsers) * 100)}%` }}
                />
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Lojas</p>
              <p className="text-2xl font-bold text-main">
                {usage.currentStores} <span className="text-base font-normal text-muted">/ {maxStores}</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.currentStores >= maxStores ? 'bg-error' : usage.currentStores >= maxStores * 0.8 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (usage.currentStores / maxStores) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          )
        })()}

        {/* Banner de mudança pendente com countdown */}
        {org?.pending_plan && (() => {
          const pendingLabel = PLAN_LABELS[org.pending_plan] || org.pending_plan
          const fromPlanLabel = PLAN_LABELS[org.previous_plan || currentPlan] || org.previous_plan || currentPlan
          const hasValidDate = org.current_period_end && !isNaN(new Date(org.current_period_end).getTime())
          const daysLeft = hasValidDate ? Math.ceil((new Date(org.current_period_end!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
          const alreadyActive = daysLeft !== null && daysLeft <= 0

          return (
            <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-xl flex items-start gap-3">
              <FiStar className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-warning">
                  {alreadyActive ? 'Mudanca de plano em vigor' : 'Mudanca de plano agendada'}
                </p>
                <p className="text-sm text-secondary mt-1">
                  {alreadyActive
                    ? <>O plano <strong>{pendingLabel}</strong> ja esta ativo. O plano anterior era <strong>{fromPlanLabel}</strong>.</>
                    : daysLeft !== null
                      ? <>Faltam <strong>{daysLeft} dia{daysLeft !== 1 ? 's' : ''}</strong> para o plano <strong>{pendingLabel}</strong> entrar em vigor. Ate la, voce mantem todas as features do plano <strong>{fromPlanLabel}</strong>.</>
                      : <>Seu plano mudara de <strong>{fromPlanLabel}</strong> para <strong>{pendingLabel}</strong>. Ate la, voce mantem todas as features do plano atual.</>
                  }
                </p>
              </div>
            </div>
          )
        })()}

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['starter', 'professional', 'enterprise'] as Plan[]).map(plan => {
            const config = planConfigs[plan]
            const isCurrent = currentPlan === plan
            const isDowngrade = planOrder.indexOf(currentPlan) > planOrder.indexOf(plan)

            return (
              <div key={plan} className={`card p-6 relative ${isCurrent ? 'border-accent border-2' : ''}`}>
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-accent text-accent-foreground text-[10px] font-bold rounded-full uppercase">
                    Plano Atual
                  </span>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <div className="text-accent">{planIcons[plan]}</div>
                  <h3 className="text-lg font-bold text-main capitalize">{config.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold text-main">R$ {config.price}</span>
                  <span className="text-sm text-muted">/mês</span>
                </div>

                <div className="mb-6 text-xs text-muted">
                  <p>Até {config.maxUsers} usuários</p>
                  <p>Até {config.maxStores} lojas</p>
                </div>

                <ul className="space-y-2 mb-6">
                  {config.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-secondary">
                      <FiCheck className="w-3.5 h-3.5 text-success shrink-0" />
                      <span>{featureLabels[f] || f.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className="w-full py-2.5 btn-secondary rounded-xl text-sm opacity-50">
                    Plano Atual
                  </button>
                ) : isDowngrade ? (
                  <button
                    onClick={() => setDowngradePlan(plan as Plan)}
                    className="w-full py-2.5 btn-secondary rounded-xl text-sm"
                  >
                    Fazer Downgrade
                  </button>
                ) : (
                  <button
                    disabled={upgrading}
                    onClick={() => {
                      if (org?.stripe_subscription_id) {
                        handleUpgradeViaApi(plan)
                      } else {
                        setSelectedPlan(plan)
                      }
                    }}
                    className="w-full py-2.5 btn-primary rounded-xl text-sm disabled:opacity-50">
                    {upgrading ? 'Atualizando...' : 'Fazer Upgrade'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cancelar assinatura (voltar para trial) */}
        {currentPlan !== 'trial' && org?.stripe_subscription_id && !org?.cancel_at_period_end && (
          <div className="mt-8 p-4 bg-surface border border-subtle rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary">Cancelar assinatura</p>
              <p className="text-xs text-muted mt-0.5">Voltar para o plano Trial gratuito no fim do período atual.</p>
            </div>
            <button
              onClick={() => setDowngradePlan('trial' as Plan)}
              className="px-4 py-2 text-sm text-error border border-error/30 rounded-xl hover:bg-error/10 transition-colors"
            >
              Cancelar assinatura
            </button>
          </div>
        )}

        {/* Info de teste */}
        <div className="mt-8 p-4 bg-surface border border-subtle rounded-xl text-xs text-muted">
          <p className="font-semibold mb-1">Modo de Teste (Sandbox)</p>
          <p>Use o cartão <code className="bg-surface-hover px-1 rounded">4242 4242 4242 4242</code> com qualquer data futura e CVC para testar pagamentos.</p>
        </div>

        </>)}
      </div>

      {/* Payment Modal (upgrade) */}
      {selectedPlan && org && (
        <PaymentModal
          isOpen={!!selectedPlan}
          onClose={() => setSelectedPlan(null)}
          plan={selectedPlan}
          orgId={org.id}
          currentPlan={currentPlan}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Downgrade Modal */}
      {downgradePlan && org && (
        <DowngradeModal
          isOpen={!!downgradePlan}
          onClose={() => setDowngradePlan(null)}
          currentPlan={currentPlan}
          targetPlan={downgradePlan}
          orgId={org.id}
          currentStoreCount={usage.currentStores}
          currentUserCount={usage.currentUsers}
          onSuccess={() => {
            // Reload completo para atualizar sidebar, features, banner
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
