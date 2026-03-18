// ============================================
// Billing — Pagina de assinatura e upgrade
// ============================================
// Permite ao admin (dono do restaurante) ver seu plano atual,
// fazer upgrade, abrir portal Stripe para gerenciar cartao.
// ============================================

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FiCheck, FiArrowLeft, FiCreditCard, FiStar, FiZap, FiShield } from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'
import { createCheckoutSession, createPortalSession, getTrialDaysRemaining } from '@/services/billing.service'
import { LoadingPage } from '@/components/ui'

type OrgBilling = {
  id: string; name: string; plan: Plan; stripe_customer_id: string | null
  stripe_subscription_id: string | null; trial_ends_at: string | null; features: string[]
}

export default function BillingPage() {
  const [org, setOrg] = useState<OrgBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const billingStatus = searchParams.get('billing')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const orgId = user.app_metadata?.org_id
      if (!orgId) { setLoading(false); return }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('organizations')
        .select('id, name, plan, stripe_customer_id, stripe_subscription_id, trial_ends_at, features')
        .eq('id', orgId)
        .single()

      if (data) setOrg(data as OrgBilling)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  const handleUpgrade = async (plan: Plan) => {
    if (!org) return
    const config = PLAN_CONFIGS[plan]
    if (!config.stripePriceId) return

    setUpgrading(plan)
    try {
      const { url } = await createCheckoutSession({
        orgId: org.id,
        priceId: config.stripePriceId,
      })
      if (url) window.location.href = url
    } catch (err) {
      console.error('[Billing] Erro checkout:', err)
      alert('Erro ao iniciar checkout. Tente novamente.')
    } finally {
      setUpgrading(null)
    }
  }

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

  if (loading) return <LoadingPage />

  const trialDays = org?.trial_ends_at ? getTrialDaysRemaining(org.trial_ends_at) : 0
  const currentPlan = org?.plan || 'trial'

  const planIcons: Record<string, React.ReactNode> = {
    trial: <FiZap className="w-5 h-5" />,
    starter: <FiStar className="w-5 h-5" />,
    professional: <FiZap className="w-5 h-5" />,
    enterprise: <FiShield className="w-5 h-5" />,
  }

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

        {/* Cards de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['starter', 'professional', 'enterprise'] as Plan[]).map(plan => {
            const config = PLAN_CONFIGS[plan]
            const isCurrent = currentPlan === plan
            const isDowngrade = ['enterprise', 'professional', 'starter'].indexOf(currentPlan) > ['enterprise', 'professional', 'starter'].indexOf(plan)

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
                      <span className="capitalize">{f.replace(/_/g, ' ')}</span>
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
                  <button onClick={() => handleUpgrade(plan)} disabled={!!upgrading}
                    className="w-full py-2.5 btn-primary rounded-xl text-sm disabled:opacity-50">
                    {upgrading === plan ? 'Redirecionando...' : 'Fazer Upgrade'}
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
    </div>
  )
}
