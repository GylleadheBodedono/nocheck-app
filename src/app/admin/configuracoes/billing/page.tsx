// ============================================
// Billing — Pagina de assinatura e upgrade
// ============================================

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FiCheck, FiArrowLeft, FiCreditCard, FiStar, FiZap, FiShield } from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'
import { createPortalSession, getTrialDaysRemaining } from '@/services/billing.service'
import { LoadingPage } from '@/components/ui'
import { PaymentModal } from '@/components/billing/PaymentModal'

type OrgBilling = {
  id: string; name: string; plan: Plan; stripe_customer_id: string | null
  stripe_subscription_id: string | null; trial_ends_at: string | null; features: string[]
  max_users: number; max_stores: number
}

type UsageStats = {
  currentUsers: number
  currentStores: number
}

export default function BillingPage() {
  const [org, setOrg] = useState<OrgBilling | null>(null)
  const [usage, setUsage] = useState<UsageStats>({ currentUsers: 0, currentStores: 0 })
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
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
    console.log('[Billing] get_my_tenant_id result:', tenantRes)
    const orgId = tenantRes.data || user.app_metadata?.org_id
    console.log('[Billing] orgId resolved:', orgId, '| app_metadata:', user.app_metadata)
    if (!orgId) { setLoading(false); return }

    const [orgRes, usersRes, storesRes] = await Promise.all([
      sb.rpc('get_org_billing', { p_org_id: orgId }),
      sb.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      sb.from('stores').select('id', { count: 'exact', head: true }).eq('tenant_id', orgId),
    ])

    console.log('[Billing] get_org_billing result:', orgRes)
    if (orgRes.data && orgRes.data.length > 0) setOrg(orgRes.data[0] as OrgBilling)
    setUsage({
      currentUsers: usersRes.count || 0,
      currentStores: storesRes.count || 0,
    })
    setLoading(false)
  }

  useEffect(() => { loadData() }, [supabase, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePortal = async () => {
    if (!org) return
    try {
      const { url } = await createPortalSession({ orgId: org.id })
      if (url) window.location.href = url
    } catch (err) {
      console.error('[Billing] Erro portal:', err)
      alert('Erro ao abrir portal. Voce precisa ter uma assinatura ativa.')
    }
  }

  const handlePaymentSuccess = () => {
    // Reload data to show updated plan
    setLoading(true)
    loadData()
  }

  if (loading) return <LoadingPage />

  const trialDays = org?.trial_ends_at ? getTrialDaysRemaining(org.trial_ends_at) : 0
  const currentPlan = (org?.plan || 'trial') as Plan

  const featureLabels: Record<string, string> = {
    basic_orders: 'Checklists ilimitados',
    basic_reports: 'Relatorios basicos',
    cancellations: 'Gestao de nao-conformidades',
    kpi_dashboard: 'Painel de indicadores (KPI)',
    bi_dashboard: 'Dashboard avancado de BI',
    export_excel: 'Exportar para Excel',
    export_pdf: 'Exportar para PDF',
    integrations_ifood: 'Integracao com iFood',
    integrations_teknisa: 'Integracao com Teknisa',
    white_label: 'Sua marca personalizada',
    api_access: 'Acesso a API',
    custom_domain: 'Dominio personalizado',
    audit_logs: 'Registro de auditoria',
    advanced_analytics: 'Analises avancadas',
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

        {/* Status messages */}
        {billingStatus === 'success' && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl mb-6 text-success text-sm">
            Pagamento confirmado! Seu plano foi atualizado.
          </div>
        )}
        {billingStatus === 'cancelled' && (
          <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl mb-6 text-warning text-sm">
            Checkout cancelado. Nenhuma cobranca foi feita.
          </div>
        )}

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
        {org && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="card p-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Usuarios</p>
              <p className="text-2xl font-bold text-main">
                {usage.currentUsers} <span className="text-base font-normal text-muted">/ {org.max_users}</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.currentUsers >= org.max_users ? 'bg-error' : usage.currentUsers >= org.max_users * 0.8 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (usage.currentUsers / org.max_users) * 100)}%` }}
                />
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Lojas</p>
              <p className="text-2xl font-bold text-main">
                {usage.currentStores} <span className="text-base font-normal text-muted">/ {org.max_stores}</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.currentStores >= org.max_stores ? 'bg-error' : usage.currentStores >= org.max_stores * 0.8 ? 'bg-warning' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (usage.currentStores / org.max_stores) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['starter', 'professional', 'enterprise'] as Plan[]).map(plan => {
            const config = PLAN_CONFIGS[plan]
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
                  <span className="text-sm text-muted">/mes</span>
                </div>

                <div className="mb-6 text-xs text-muted">
                  <p>Ate {config.maxUsers} usuarios</p>
                  <p>Ate {config.maxStores} lojas</p>
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
                  <button onClick={handlePortal} className="w-full py-2.5 btn-secondary rounded-xl text-sm">
                    Fazer Downgrade
                  </button>
                ) : (
                  <button onClick={() => setSelectedPlan(plan)}
                    className="w-full py-2.5 btn-primary rounded-xl text-sm">
                    Fazer Upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Info de teste */}
        <div className="mt-8 p-4 bg-surface border border-subtle rounded-xl text-xs text-muted">
          <p className="font-semibold mb-1">Modo de Teste (Sandbox)</p>
          <p>Use o cartao <code className="bg-surface-hover px-1 rounded">4242 4242 4242 4242</code> com qualquer data futura e CVC para testar pagamentos.</p>
        </div>
      </div>

      {/* Payment Modal */}
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
    </div>
  )
}
