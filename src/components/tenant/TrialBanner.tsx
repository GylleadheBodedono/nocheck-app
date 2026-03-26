// ============================================
// TrialBanner — Banner de trial com dias restantes
// ============================================
// Mostra um banner no topo do dashboard quando o tenant
// esta no periodo de trial, com dias restantes e link
// para upgrade.
// ============================================

'use client'

import { useTenant } from '@/hooks/useTenant'
import { getTrialDaysRemaining } from '@/services/billing.service'
import { FiZap, FiX } from 'react-icons/fi'
import Link from 'next/link'
import { useState } from 'react'

export function TrialBanner() {
  const { organization, isOrgAdmin } = useTenant()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (!organization) return null
  if (organization.plan !== 'trial') return null

  const daysLeft = getTrialDaysRemaining(organization.trial_ends_at)
  if (daysLeft <= 0) return null

  const isUrgent = daysLeft <= 3
  const bgColor = isUrgent ? 'bg-error/10 border-error/30' : 'bg-warning/10 border-warning/30'
  const textColor = isUrgent ? 'text-error' : 'text-warning'
  const iconBg = isUrgent ? 'bg-error/20' : 'bg-warning/20'

  return (
    <div className={`mx-auto px-4 sm:px-6 lg:px-8 pt-4`}>
      <div className={`card p-4 ${bgColor} border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            <FiZap className={`w-5 h-5 ${textColor}`} />
          </div>
          <div>
            <p className="font-medium text-main text-sm">
              {isUrgent
                ? `Seu trial expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}!`
                : `${daysLeft} dias restantes no trial`}
            </p>
            <p className="text-xs text-muted">
              {isUrgent
                ? 'Faça upgrade agora para não perder acesso.'
                : 'Aproveite para conhecer todas as funcionalidades.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOrgAdmin && (
            <Link
              href="/admin/configuracoes/billing"
              className="btn-primary text-xs px-4 py-2 shrink-0"
            >
              Fazer Upgrade
            </Link>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-muted hover:text-main rounded-lg transition-colors shrink-0"
            title="Fechar"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
