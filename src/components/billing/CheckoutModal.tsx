'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { FiCheck, FiLock, FiArrowLeft, FiTag } from 'react-icons/fi'
import { PLAN_CONFIGS, type Plan, type PlanConfig } from '@/types/tenant'
import { fetchPlanConfigs } from '@/lib/plans'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ── Card Brand Icons ──

function VisaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#1A1F71" />
      <path d="M19.5 21H17L18.8 11H21.3L19.5 21ZM15.2 11L12.8 18L12.5 16.5L11.6 12C11.6 12 11.5 11 10.2 11H6.1L6 11.2C6 11.2 7.5 11.5 9.2 12.5L11.4 21H14L18 11H15.2ZM35.5 21H37.8L35.8 11H33.8C32.7 11 32.4 11.8 32.4 11.8L28.6 21H31.2L31.7 19.5H34.9L35.5 21ZM32.4 17.5L33.8 13.5L34.6 17.5H32.4ZM28.5 13.5L28.8 11.8C28.8 11.8 27.5 11.3 26.1 11.3C24.6 11.3 21.1 12 21.1 15.1C21.1 18 25.2 18 25.2 19.5C25.2 21 21.5 20.7 20.3 19.8L19.9 21.6C19.9 21.6 21.3 22.2 23.2 22.2C25.1 22.2 28.4 21 28.4 18.2C28.4 15.3 24.2 15 24.2 13.8C24.2 12.6 27.1 12.8 28.5 13.5Z" fill="white" />
    </svg>
  )
}

function MastercardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#252525" />
      <circle cx="19" cy="16" r="9" fill="#EB001B" />
      <circle cx="29" cy="16" r="9" fill="#F79E1B" />
      <path d="M24 9.3A9 9 0 0 1 27.5 16 9 9 0 0 1 24 22.7 9 9 0 0 1 20.5 16 9 9 0 0 1 24 9.3Z" fill="#FF5F00" />
    </svg>
  )
}

function EloIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#000" />
      <text x="24" y="18" textAnchor="middle" fill="#FFCB05" fontSize="12" fontWeight="bold" fontFamily="Arial">elo</text>
    </svg>
  )
}

function GenericCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#374151" />
      <rect x="4" y="8" width="16" height="4" rx="1" fill="#6B7280" />
      <rect x="4" y="16" width="40" height="2" rx="1" fill="#4B5563" />
      <rect x="4" y="22" width="12" height="2" rx="1" fill="#4B5563" />
    </svg>
  )
}

const BRAND_ICONS: Record<string, React.FC<{ className?: string }>> = {
  visa: VisaIcon,
  mastercard: MastercardIcon,
  elo: EloIcon,
  unknown: GenericCardIcon,
}

const FEATURE_LABELS: Record<string, string> = {
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

// ── Checkout Form (inner, needs Stripe context) ──

type BillingCycle = 'monthly' | 'yearly'

type CheckoutFormInnerProps = {
  selectedPlan: Plan
  onPlanChange: (plan: Plan) => void
  orgId: string
  onSuccess: () => void
  onBack: () => void
  onSkip: () => void
}

function CheckoutFormInner({ selectedPlan, onPlanChange, orgId, onSuccess, onBack, onSkip }: CheckoutFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardBrand, setCardBrand] = useState('unknown')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [holderName, setHolderName] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [showPromo, setShowPromo] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')

  const [dynConfigs, setDynConfigs] = useState<Record<string, PlanConfig>>(PLAN_CONFIGS)
  useEffect(() => { fetchPlanConfigs().then(setDynConfigs) }, [])

  const plans: Plan[] = ['starter', 'professional', 'enterprise']
  const config = dynConfigs[selectedPlan] || PLAN_CONFIGS[selectedPlan]
  const BrandIcon = BRAND_ICONS[cardBrand] || BRAND_ICONS.unknown

  const isYearly = billingCycle === 'yearly'
  const monthlyPrice = config.price
  const yearlyMonthlyPrice = Math.round(monthlyPrice * 0.8) // 20% off
  const displayPrice = isYearly ? yearlyMonthlyPrice : monthlyPrice
  const yearlyTotal = yearlyMonthlyPrice * 12

  const [stripeTimeout, setStripeTimeout] = useState(false)
  useEffect(() => {
    if (stripe) return
    const timer = setTimeout(() => setStripeTimeout(true), 3000)
    return () => clearTimeout(timer)
  }, [stripe])

  const elementStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: 'var(--color-text-main, #E5E5E5)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': { color: 'var(--color-text-muted, #6B7280)' },
      },
      invalid: { color: '#EF4444' },
    },
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setError(null)

    const cardNumber = elements.getElement(CardNumberElement)
    if (!cardNumber) {
      setError('Erro ao carregar formulário')
      setProcessing(false)
      return
    }

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: { name: holderName || undefined },
    })

    if (pmError) {
      setError(pmError.message || 'Erro ao processar cartão')
      setProcessing(false)
      return
    }

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          priceId: config.stripePriceId,
          paymentMethodId: paymentMethod.id,
        }),
      })

      const data = await res.json()

      if (data.requires_action && data.client_secret) {
        const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret)
        if (confirmError) {
          setError(confirmError.message || 'Erro na autenticação 3D Secure')
          setProcessing(false)
          return
        }
      }

      if (data.error) {
        setError(data.error)
        setProcessing(false)
        return
      }

      setSuccess(true)
      setTimeout(onSuccess, 2000)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    }

    setProcessing(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="card p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiCheck className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-main mb-2">Assinatura confirmada!</h2>
          <p className="text-muted">
            Seu plano <span className="text-accent font-semibold capitalize">{config.name}</span> já está ativo.
          </p>
          <p className="text-xs text-muted mt-2">Redirecionando...</p>
        </div>
      </div>
    )
  }

  if (!stripe && !stripeTimeout) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted">Carregando checkout...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-8xl card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 min-h-[600px]">

          {/* ══ Left — Plan selection + summary (gradient) ══ */}
          <div className="lg:col-span-2 relative overflow-hidden p-6 lg:p-8 flex flex-col">
            <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED] via-[#A855F7] to-[#EC4899]" />
            <div className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `radial-gradient(at 20% 30%, rgba(255,255,255,0.2) 0%, transparent 50%),
                                  radial-gradient(at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 50%)`,
              }}
            />

            <div className="relative z-10 flex flex-col h-full">
              {/* Back */}
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors mb-6"
              >
                <FiArrowLeft className="w-4 h-4" />
                Voltar
              </button>

              {/* Header */}
              <p className="text-white/70 text-sm mb-1">Escolha seu plano</p>
              <h2 className="text-3xl font-bold text-white mb-1">
                R$ {displayPrice}<span className="text-lg font-normal text-white/60">/mês</span>
              </h2>
              {isYearly && (
                <div className="mb-4">
                  <p className="text-2xl font-bold text-white">
                    R$ {yearlyTotal.toLocaleString('pt-BR')},00<span className="text-sm font-normal text-white/60">/ano</span>
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-500/20 border border-green-400/30 text-green-300 text-xs font-semibold rounded-full">
                    Economia de 20%
                  </span>
                </div>
              )}
              {!isYearly && <div className="mb-4" />}

              {/* Billing cycle toggle */}
              <div className="flex gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    !isYearly
                      ? 'bg-white/20 text-white border border-white/40'
                      : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    isYearly
                      ? 'bg-white/20 text-white border border-white/40'
                      : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
                  }`}
                >
                  Anual
                  <span className="px-1.5 py-0.5 bg-green-500 text-white text-[9px] font-bold rounded-full">-20%</span>
                </button>
              </div>

              {/* Plan selector cards */}
              <div className="space-y-2 mb-6">
                {plans.map(plan => {
                  const pc = dynConfigs[plan] || PLAN_CONFIGS[plan]
                  const isSelected = selectedPlan === plan
                  const pcPrice = isYearly ? Math.round(pc.price * 0.8) : pc.price
                  return (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => onPlanChange(plan)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                        isSelected
                          ? 'bg-white/20 border-2 border-white/50'
                          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        isSelected ? 'bg-white text-purple-600' : 'bg-white/10 text-white'
                      }`}>
                        {pc.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{pc.name}</p>
                        <p className="text-white/50 text-[11px]">
                          {pc.maxUsers} usuários &middot; {pc.maxStores} lojas
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {isYearly && (
                          <p className="text-white/30 text-[10px] line-through">R$ {pc.price}</p>
                        )}
                        <p className="text-white font-bold text-sm">R$ {pcPrice}</p>
                        <p className="text-white/40 text-[10px]">/mês</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                          <FiCheck className="w-3 h-3 text-purple-600" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Features of selected plan — incremental display */}
              <div className="flex-1">
                {(() => {
                  const starterFeatures = (dynConfigs.starter || PLAN_CONFIGS.starter).features
                  const baseFeatures = starterFeatures
                  const extraFeatures = config.features.filter(f => !starterFeatures.includes(f))
                  const isStarter = selectedPlan === 'starter'

                  return (
                    <>
                      <p className="text-white/50 text-[10px] uppercase tracking-wider mb-2 font-semibold">
                        {isStarter ? 'Incluso no plano' : 'Base (Starter)'}
                      </p>
                      <ul className="space-y-1">
                        {baseFeatures.map(f => (
                          <li key={f} className="flex items-center gap-2 text-[11px] text-white/40">
                            <FiCheck className="w-3 h-3 text-white/30 shrink-0" />
                            {FEATURE_LABELS[f] || f}
                          </li>
                        ))}
                      </ul>
                      {extraFeatures.length > 0 && (
                        <>
                          <p className="text-white/70 text-[10px] uppercase tracking-wider mt-3 mb-2 font-semibold">
                            + Extras do {config.name}
                          </p>
                          <ul className="space-y-1">
                            {extraFeatures.map(f => (
                              <li key={f} className="flex items-center gap-2 text-[11px] text-white font-medium">
                                <FiCheck className="w-3 h-3 text-green-400 shrink-0" />
                                {FEATURE_LABELS[f] || f}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )
                })()}
              </div>

              {/* Promo + Totals */}
              <div className="mt-4 pt-4 border-t border-white/20">
                {showPromo ? (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value)}
                      placeholder="Código promocional"
                      className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPromo(false)}
                      className="px-3 py-2 text-white/60 text-xs hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPromo(true)}
                    className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-3 transition-colors"
                  >
                    <FiTag className="w-3 h-3" />
                    Adicionar código promocional
                  </button>
                )}

                <div className="space-y-1.5">
                  {isYearly && (
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Preço original</span>
                      <span className="text-white/40 line-through">R$ {monthlyPrice},00/mês</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Subtotal</span>
                    <span className="text-white">
                      R$ {isYearly ? `${yearlyTotal.toLocaleString('pt-BR')},00` : `${displayPrice},00`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span className="text-white">Total hoje</span>
                    <span className="text-white">
                      R$ {isYearly ? `${yearlyTotal.toLocaleString('pt-BR')},00` : `${displayPrice},00`}
                    </span>
                  </div>
                  {isYearly && (
                    <p className="text-[10px] text-green-300">
                      Você economiza R$ {((monthlyPrice * 12) - yearlyTotal).toLocaleString('pt-BR')},00 por ano
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ══ Right — Payment form ══ */}
          <div className="lg:col-span-3 p-6 lg:p-8 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Payment method header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-main">Informações de pagamento</h3>
                  <button
                    type="button"
                    onClick={onSkip}
                    className=" hover:text-black transition-colors bg-green-600 rounded border-black text-white p-2 border-black rounded-lg "
                  >
                    Pular etapa
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <VisaIcon className="w-10 h-7 rounded-sm" />
                  <MastercardIcon className="w-10 h-7 rounded-sm" />
                  <EloIcon className="w-10 h-7 rounded-sm" />
                </div>
              </div>

              {/* Card Number */}
              <div>
                <label className="text-xs text-muted font-medium block mb-2">Número do cartão</label>
                <div className="relative">
                  <div className="w-full px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-primary">
                    <CardNumberElement
                      options={elementStyle}
                      onChange={(e) => {
                        setCardBrand(e.brand || 'unknown')
                        if (e.error) setError(e.error.message)
                        else setError(null)
                      }}
                    />
                  </div>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <BrandIcon className="w-10 h-7 rounded-sm shadow-sm" />
                  </div>
                </div>
              </div>

              {/* Expiry + CVC */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted font-medium block mb-2">Validade</label>
                  <div className="px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-primary">
                    <CardExpiryElement options={elementStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted font-medium block mb-2">CVC</label>
                  <div className="px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-primary">
                    <CardCvcElement options={elementStyle} />
                  </div>
                </div>
              </div>

              {/* Card holder name */}
              <div>
                <label className="text-xs text-muted font-medium block mb-2">Nome no cartão</label>
                <input
                  type="text"
                  value={holderName}
                  onChange={e => setHolderName(e.target.value)}
                  placeholder="Como está impresso no cartão"
                  className="w-full px-4 py-3 bg-surface border border-subtle rounded-xl text-sm text-main placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={processing || !stripe}
                className="w-full py-3.5 btn-primary rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FiLock className="w-4 h-4" />
                    Assinar — R$ {displayPrice}/mês
                  </>
                )}
              </button>

              {/* Security */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted">
                <FiLock className="w-3 h-3" />
                <span>Pagamento seguro processado pelo Stripe. Seus dados estão protegidos.</span>
              </div>

              {/* Test mode */}
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl">
                <p className="text-[10px] text-warning font-semibold mb-1">Modo de Teste</p>
                <p className="text-[10px] text-muted">
                  Use <code className="bg-surface-hover px-1 rounded">4242 4242 4242 4242</code> com qualquer data futura e CVC.
                </p>
              </div>

              {/* Skip */}
              <button
                type="button"
                onClick={onSkip}
                className="w-full py-2.5  hover:text-main transition-colors  hover:text-black transition-colors bg-green-600 rounded border-black text-white p-2 border-black rounded-lg"
              >
                Não quero agora
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Checkout Component ──

type CheckoutProps = {
  orgId: string
  onBack: () => void
  onSuccess: () => void
  onSkip: () => void
}

export function CheckoutFlow({ orgId, onBack, onSuccess, onSkip }: CheckoutProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('professional')

  return (
    <Elements stripe={stripePromise}>
      <CheckoutFormInner
        selectedPlan={selectedPlan}
        onPlanChange={setSelectedPlan}
        orgId={orgId}
        onSuccess={onSuccess}
        onBack={onBack}
        onSkip={onSkip}
      />
    </Elements>
  )
}
