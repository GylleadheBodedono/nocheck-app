'use client'

import { useState, useEffect } from 'react'
import { FiAlertTriangle, FiArrowDown, FiCalendar, FiX } from 'react-icons/fi'
import { PLAN_CONFIGS, type Plan, type PlanConfig } from '@/types/tenant'
import { fetchPlanConfigs } from '@/lib/plans'
import { Modal } from '@/components/ui/Modal'

type Props = {
  isOpen: boolean
  onClose: () => void
  currentPlan: Plan
  targetPlan: Plan
  orgId: string
  currentStoreCount: number
  currentUserCount: number
  onSuccess: (pendingPlan: string, effectiveDate: string) => void
}

const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial (Grátis)',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

export function DowngradeModal({
  isOpen, onClose, currentPlan, targetPlan, orgId,
  currentStoreCount, currentUserCount, onSuccess,
}: Props) {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pc, setPc] = useState<Record<string, PlanConfig>>(PLAN_CONFIGS)
  useEffect(() => { fetchPlanConfigs().then(setPc) }, [])

  const currentConfig = pc[currentPlan] || PLAN_CONFIGS[currentPlan]
  const targetConfig = pc[targetPlan] || PLAN_CONFIGS[targetPlan]

  const storesBlocked = Math.max(0, currentStoreCount - (targetConfig?.maxStores || 0))
  const usersExceeded = Math.max(0, currentUserCount - (targetConfig?.maxUsers || 0))

  // Features que serão perdidas
  const currentFeatures = new Set(currentConfig?.features || [])
  const targetFeatures = new Set(targetConfig?.features || [])
  const lostFeatures = [...currentFeatures].filter(f => !targetFeatures.has(f))

  const featureLabels: Record<string, string> = {
    basic_orders: 'Pedidos básicos',
    basic_reports: 'Relatórios básicos',
    cancellations: 'Cancelamentos',
    kpi_dashboard: 'Dashboard KPI',
    bi_dashboard: 'Dashboard BI',
    export_excel: 'Exportar Excel',
    export_pdf: 'Exportar PDF',
    integrations_ifood: 'Integração iFood',
    integrations_teknisa: 'Integração Teknisa',
    white_label: 'Marca própria (White Label)',
    api_access: 'Acesso API',
    custom_domain: 'Domínio personalizado',
    audit_logs: 'Logs de auditoria',
    advanced_analytics: 'Analytics avançado',
  }

  const handleConfirm = async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, newPlan: targetPlan }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao mudar plano')
        setProcessing(false)
        return
      }
      onSuccess(data.pendingPlan || targetPlan, data.effectiveDate || '')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro de conexão')
      setProcessing(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirmar mudança de plano" size="md">
      <div className="space-y-5">
        {/* Plano atual → novo */}
        <div className="flex items-center justify-center gap-4 py-3">
          <div className="text-center">
            <p className="text-xs text-muted uppercase">Atual</p>
            <p className="text-lg font-bold text-main">{PLAN_LABELS[currentPlan]}</p>
            <p className="text-sm text-muted">R$ {currentConfig?.price || 0}/mês</p>
          </div>
          <FiArrowDown className="w-6 h-6 text-warning rotate-[-90deg]" />
          <div className="text-center">
            <p className="text-xs text-muted uppercase">Novo</p>
            <p className="text-lg font-bold text-warning">{PLAN_LABELS[targetPlan]}</p>
            <p className="text-sm text-muted">R$ {targetConfig?.price || 0}/mês</p>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 bg-error/10 border border-error/30 rounded-xl text-sm text-error">
            {error}
          </div>
        )}

        {/* Impactos */}
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-warning text-sm font-medium">
            <FiAlertTriangle className="w-4 h-4" />
            O que muda:
          </div>
          <ul className="text-sm text-secondary space-y-1 ml-6 list-disc">
            <li>Limite de lojas: {currentConfig?.maxStores} → {targetConfig?.maxStores}</li>
            <li>Limite de usuários: {currentConfig?.maxUsers} → {targetConfig?.maxUsers}</li>
            {storesBlocked > 0 && (
              <li className="text-error font-medium">{storesBlocked} loja{storesBlocked > 1 ? 's' : ''} será{storesBlocked > 1 ? 'o' : ''} bloqueada{storesBlocked > 1 ? 's' : ''}</li>
            )}
            {usersExceeded > 0 && (
              <li className="text-error font-medium">{usersExceeded} usuário{usersExceeded > 1 ? 's' : ''} excede{usersExceeded > 1 ? 'm' : ''} o limite</li>
            )}
            {lostFeatures.length > 0 && (
              <li>Features removidas: {lostFeatures.map(f => featureLabels[f] || f).join(', ')}</li>
            )}
          </ul>
        </div>

        {/* Data efetiva */}
        <div className="flex items-center gap-2 text-sm text-muted bg-surface-hover rounded-xl p-3">
          <FiCalendar className="w-4 h-4 text-primary" />
          <p>A mudança será efetiva no fim do período de faturamento atual. Você manterá o plano {PLAN_LABELS[currentPlan]} até lá.</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 rounded-xl p-3 flex items-center gap-2">
            <FiX className="w-4 h-4 text-error shrink-0" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 btn-secondary rounded-xl text-sm" disabled={processing}>
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={processing}
            className="flex-1 py-2.5 bg-warning text-white rounded-xl text-sm font-medium hover:bg-warning/90 transition-colors disabled:opacity-50">
            {processing ? 'Processando...' : 'Confirmar Downgrade'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
