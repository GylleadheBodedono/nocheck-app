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
import { FiCheck, FiLock } from 'react-icons/fi'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'
import { Modal } from '@/components/ui'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// SVG card brand icons
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

function AmexIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#006FCF" />
      <text x="24" y="18" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">AMEX</text>
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

function HipercardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#822124" />
      <text x="24" y="19" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">HIPERCARD</text>
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
      <rect x="20" y="22" width="8" height="2" rx="1" fill="#4B5563" />
    </svg>
  )
}

function DinersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#0079BE" />
      <circle cx="24" cy="16" r="9" fill="white" />
      <circle cx="21" cy="16" r="6" fill="none" stroke="#0079BE" strokeWidth="1.5" />
      <circle cx="27" cy="16" r="6" fill="none" stroke="#0079BE" strokeWidth="1.5" />
    </svg>
  )
}

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="32" rx="4" fill="#fff" />
      <rect x="0.5" y="0.5" width="47" height="31" rx="3.5" stroke="#D1D5DB" />
      <text x="24" y="19" textAnchor="middle" fill="#FF6600" fontSize="9" fontWeight="bold" fontFamily="Arial">DISCOVER</text>
    </svg>
  )
}

// Map brand string from Stripe to icon component
const BRAND_ICONS: Record<string, React.FC<{ className?: string }>> = {
  visa: VisaIcon,
  mastercard: MastercardIcon,
  amex: AmexIcon,
  elo: EloIcon,
  hipercard: HipercardIcon,
  discover: DiscoverIcon,
  diners: DinersIcon,
  jcb: AmexIcon, // fallback
  unionpay: GenericCardIcon,
  unknown: GenericCardIcon,
}

const FEATURE_LABELS: Record<string, string> = {
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

type Props = {
  isOpen: boolean
  onClose: () => void
  plan: Plan
  orgId: string
  currentPlan: Plan
  onSuccess: () => void
}

function PaymentForm({ plan, orgId, onSuccess, onClose }: Omit<Props, 'isOpen' | 'currentPlan'>) {
  const stripe = useStripe()
  const elements = useElements()
  const [cardBrand, setCardBrand] = useState('unknown')
  const [paymentType, setPaymentType] = useState<'credit' | 'debit'>('credit')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [holderName, setHolderName] = useState('')

  const config = PLAN_CONFIGS[plan]
  const BrandIcon = BRAND_ICONS[cardBrand] || BRAND_ICONS.unknown

  // Stripe Elements loading state
  const [stripeTimeout, setStripeTimeout] = useState(false)
  useEffect(() => {
    if (stripe) return // already loaded
    const timer = setTimeout(() => setStripeTimeout(true), 3000)
    return () => clearTimeout(timer)
  }, [stripe])

  if (!stripe && !stripeTimeout) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">Carregando processador de pagamento...</p>
      </div>
    )
  }
  if (!stripe && stripeTimeout) {
    return (
      <div className="text-center py-8">
        <p className="text-muted">Processador de pagamento nao disponivel.</p>
        <p className="text-xs text-muted mt-2">Verifique a configuracao do Stripe (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).</p>
      </div>
    )
  }

  const elementStyle = {
    style: {
      base: {
        fontSize: '16px',
        color: '#E5E5E5',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        '::placeholder': { color: '#6B7280' },
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
      setError('Erro ao carregar formulario')
      setProcessing(false)
      return
    }

    // Create payment method
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardNumber,
      billing_details: { name: holderName || undefined },
    })

    if (pmError) {
      setError(pmError.message || 'Erro ao processar cartao')
      setProcessing(false)
      return
    }

    // Send to API
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
        // Handle 3D Secure
        const { error: confirmError } = await stripe.confirmCardPayment(data.client_secret)
        if (confirmError) {
          setError(confirmError.message || 'Erro na autenticacao 3D Secure')
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
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)
    } catch {
      setError('Erro de conexao. Tente novamente.')
    }

    setProcessing(false)
  }

  if (success) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto">
          <FiCheck className="w-8 h-8 text-success" />
        </div>
        <h3 className="text-lg font-bold text-main">Pagamento confirmado!</h3>
        <p className="text-sm text-muted">Seu plano foi atualizado para <span className="text-accent font-semibold capitalize">{config.name}</span></p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan summary */}
      <div className="p-4 bg-surface-hover rounded-xl flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-main capitalize">{config.name}</p>
          <p className="text-xs text-muted">Ate {config.maxUsers} usuarios · {config.maxStores} lojas</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-main">R$ {config.price}</p>
          <p className="text-xs text-muted">/mes</p>
        </div>
      </div>

      {/* Payment type toggle */}
      <div>
        <label className="text-xs text-muted font-medium block mb-2">Tipo de pagamento</label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPaymentType('credit')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              paymentType === 'credit'
                ? 'bg-accent text-white'
                : 'bg-surface border border-subtle text-muted hover:text-main'
            }`}>
            Credito
          </button>
          <button type="button" onClick={() => setPaymentType('debit')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
              paymentType === 'debit'
                ? 'bg-accent text-white'
                : 'bg-surface border border-subtle text-muted hover:text-main'
            }`}>
            Debito
          </button>
        </div>
      </div>

      {/* Card holder name */}
      <div>
        <label className="text-xs text-muted font-medium block mb-2">Nome no cartao</label>
        <input
          type="text"
          value={holderName}
          onChange={e => setHolderName(e.target.value)}
          placeholder="Como esta impresso no cartao"
          className="w-full px-4 py-3 bg-surface border border-subtle rounded-xl text-sm text-main placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {/* Card number with brand detection */}
      <div>
        <label className="text-xs text-muted font-medium block mb-2">Numero do cartao</label>
        <div className="relative">
          <div className="w-full px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-accent">
            <CardNumberElement
              options={elementStyle}
              onChange={(e) => {
                setCardBrand(e.brand || 'unknown')
                if (e.error) setError(e.error.message)
                else setError(null)
              }}
            />
          </div>
          {/* Brand icon */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 transition-all duration-300">
            <BrandIcon className="w-10 h-7 rounded-sm shadow-sm" />
          </div>
        </div>
      </div>

      {/* Expiry + CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted font-medium block mb-2">Validade</label>
          <div className="px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-accent">
            <CardExpiryElement options={elementStyle} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted font-medium block mb-2">CVC</label>
          <div className="px-4 py-3 bg-surface border border-subtle rounded-xl focus-within:ring-2 focus-within:ring-accent">
            <CardCvcElement options={elementStyle} />
          </div>
        </div>
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
            Pagar R$ {config.price}/mes
          </>
        )}
      </button>

      {/* Security info */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted">
        <FiLock className="w-3 h-3" />
        <span>Pagamento seguro processado pelo Stripe. Seus dados estao protegidos.</span>
      </div>
    </form>
  )
}

export function PaymentModal({ isOpen, onClose, plan, orgId, currentPlan, onSuccess }: Props) {
  const config = PLAN_CONFIGS[plan]
  const currentConfig = PLAN_CONFIGS[currentPlan]

  // Features gained with upgrade
  const newFeatures = config.features.filter(f => !currentConfig.features.includes(f))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Upgrade para ${config.name}`} size="lg">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Left: what you get */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-main mb-3">O que voce ganha</h3>
            <ul className="space-y-2">
              {newFeatures.map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-secondary">
                  <FiCheck className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>{FEATURE_LABELS[f] || f}</span>
                </li>
              ))}
              {config.maxUsers > currentConfig.maxUsers && (
                <li className="flex items-center gap-2 text-xs text-secondary">
                  <FiCheck className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>Ate {config.maxUsers} usuarios (era {currentConfig.maxUsers})</span>
                </li>
              )}
              {config.maxStores > currentConfig.maxStores && (
                <li className="flex items-center gap-2 text-xs text-secondary">
                  <FiCheck className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>Ate {config.maxStores} lojas (era {currentConfig.maxStores})</span>
                </li>
              )}
            </ul>
          </div>

          {/* Test mode info */}
          <div className="p-3 bg-warning/10 border border-warning/20 rounded-xl">
            <p className="text-[10px] text-warning font-semibold mb-1">Modo de Teste</p>
            <p className="text-[10px] text-muted">
              Use <code className="bg-surface-hover px-1 rounded">4242 4242 4242 4242</code> com qualquer data futura e CVC.
            </p>
          </div>
        </div>

        {/* Right: payment form */}
        <div className="md:col-span-3">
          <Elements stripe={stripePromise}>
            <PaymentForm plan={plan} orgId={orgId} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        </div>
      </div>
    </Modal>
  )
}
