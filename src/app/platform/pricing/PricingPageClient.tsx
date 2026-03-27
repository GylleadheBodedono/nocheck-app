'use client'

import { useState } from 'react'
import { FiDollarSign, FiSave, FiCheck, FiAlertCircle, FiUsers, FiHome, FiToggleRight } from 'react-icons/fi'

type PricingRow = {
  id: string
  name: string
  price_brl: number
  max_users: number
  max_stores: number
  features: string[]
  stripe_price_id: string
  sort_order: number
  is_active: boolean
}

const ALL_FEATURES = [
  { id: 'basic_orders', label: 'Checklists ilimitados' },
  { id: 'basic_reports', label: 'Relatorios basicos' },
  { id: 'cancellations', label: 'Gestao de nao-conformidades' },
  { id: 'kpi_dashboard', label: 'Painel de indicadores (KPI)' },
  { id: 'bi_dashboard', label: 'Dashboard avancado de BI' },
  { id: 'export_excel', label: 'Exportar para Excel' },
  { id: 'export_pdf', label: 'Exportar para PDF' },
  { id: 'integrations_ifood', label: 'Integracao com iFood' },
  { id: 'integrations_teknisa', label: 'Integracao com Teknisa' },
  { id: 'white_label', label: 'Marca personalizada' },
  { id: 'api_access', label: 'Acesso a API' },
  { id: 'custom_domain', label: 'Dominio personalizado' },
  { id: 'audit_logs', label: 'Registro de auditoria' },
  { id: 'advanced_analytics', label: 'Analises avancadas' },
]

type PricingPageClientProps = {
  initialPlans: PricingRow[]
}

export default function PricingPageClient({ initialPlans }: PricingPageClientProps) {
  const [plans, setPlans] = useState<PricingRow[]>(initialPlans)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)

  const updatePlan = (planId: string, field: keyof PricingRow, value: unknown) => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, [field]: value } : p))
    setSaved(false)
  }

  const toggleFeature = (planId: string, featureId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p
      const has = p.features.includes(featureId)
      return { ...p, features: has ? p.features.filter(f => f !== featureId) : [...p.features, featureId] }
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/platform/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plans),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Falha ao salvar')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-main">Gerenciar Pricing</h1>
          <p className="text-sm text-muted mt-1">Altere precos, limites e features dos planos. Mudancas refletem imediatamente na landing page e em toda a aplicacao.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-colors ${
            saved ? 'bg-success text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-50`}
        >
          {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : saved ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alteracoes'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-xl flex items-center gap-2 text-sm text-error">
          <FiAlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="card border border-subtle rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FiDollarSign className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-main">{plan.name}</h3>
                  <p className="text-xs text-muted">
                    R$ {plan.price_brl}/mes · {plan.max_users >= 999 ? 'ilimitados' : plan.max_users} usuarios · {plan.max_stores >= 999 ? 'ilimitadas' : plan.max_stores} lojas · {plan.features.length} features
                  </p>
                </div>
              </div>
              <svg className={`w-5 h-5 text-muted transition-transform ${expandedPlan === plan.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {expandedPlan === plan.id && (
              <div className="border-t border-subtle p-4 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-medium text-secondary mb-1 block">Nome</label>
                    <input type="text" value={plan.name} onChange={e => updatePlan(plan.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary mb-1 flex items-center gap-1"><FiDollarSign className="w-3 h-3" /> Preco (R$/mes)</label>
                    <input type="number" value={plan.price_brl} onChange={e => updatePlan(plan.id, 'price_brl', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary mb-1 flex items-center gap-1"><FiUsers className="w-3 h-3" /> Max Usuarios</label>
                    <input type="number" value={plan.max_users} onChange={e => updatePlan(plan.id, 'max_users', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-secondary mb-1 flex items-center gap-1"><FiHome className="w-3 h-3" /> Max Lojas</label>
                    <input type="number" value={plan.max_stores} onChange={e => updatePlan(plan.id, 'max_stores', Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-secondary mb-1 block">Stripe Price ID</label>
                  <input type="text" value={plan.stripe_price_id} onChange={e => updatePlan(plan.id, 'stripe_price_id', e.target.value)}
                    placeholder="price_..." className="w-full px-3 py-2 rounded-lg text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary font-mono" />
                </div>

                <div>
                  <label className="text-xs font-medium text-secondary mb-2 flex items-center gap-1"><FiToggleRight className="w-3 h-3" /> Features habilitadas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ALL_FEATURES.map(feat => {
                      const enabled = plan.features.includes(feat.id)
                      return (
                        <button key={feat.id} type="button" onClick={() => toggleFeature(plan.id, feat.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                            enabled ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-surface text-muted border border-subtle hover:border-primary/20'
                          }`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${enabled ? 'bg-primary text-white' : 'bg-surface-hover'}`}>
                            {enabled && <FiCheck className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{feat.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
