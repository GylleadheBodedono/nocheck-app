'use client'

import { memo } from 'react'
import type { ReincidenciaSummary, ReincidenciaRow, AssigneeStats } from '@/lib/analyticsQueries'
import type { Period } from '../_types'

type Props = {
  period: Period
  setPeriod: (p: Period) => void
  reincSummary: ReincidenciaSummary
  reincRows: ReincidenciaRow[]
  assigneeStats: AssigneeStats[]
  exportDropdownNode: React.ReactNode
  isLoading?: boolean
}

export const ReincidenciasTab = memo(function ReincidenciasTab({
  period, setPeriod,
  reincSummary, reincRows, assigneeStats,
  exportDropdownNode, isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface-hover rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-surface-hover rounded-xl" />)}
        </div>
        <div className="h-64 bg-surface-hover rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      {/* Period filter */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-main">Reincidências</h2>
        <div className="flex items-center gap-2">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
          {exportDropdownNode}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-2xl font-bold text-error">{reincSummary.totalReincidencias}</p>
          <p className="text-xs text-muted">Total Reincidências</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-warning">{reincSummary.avgReincidenciaRate}</p>
          <p className="text-xs text-muted">Media por Campo</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-bold text-main truncate">{reincSummary.worstField || '-'}</p>
          <p className="text-xs text-muted">Pior Campo</p>
        </div>
        <div className="card p-4">
          <p className="text-sm font-bold text-main truncate">{reincSummary.worstStore || '-'}</p>
          <p className="text-xs text-muted">Pior Loja</p>
        </div>
      </div>

      {/* Reincidencia table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-subtle">
          <h3 className="font-semibold text-main">Campos com Reincidência</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Campo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Template</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Ocorrencias</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Ultima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {reincRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhuma reincidencia no periodo</td></tr>
              ) : reincRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-medium text-main text-sm">{row.fieldName}</td>
                  <td className="px-4 py-3 text-sm text-secondary">{row.storeName}</td>
                  <td className="px-4 py-3 text-sm text-muted">{row.templateName}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold bg-error/20 text-error">{row.occurrences}x</span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted">
                    {new Date(row.lastOccurrence).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignee stats */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h3 className="font-semibold text-main">Desempenho por Responsável</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Responsavel</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Planos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Concluidos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Vencidos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Tempo Medio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {assigneeStats.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhum dado</td></tr>
              ) : assigneeStats.map(a => (
                <tr key={a.userId} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-medium text-main text-sm">{a.userName}</td>
                  <td className="px-4 py-3 text-right text-sm text-main">{a.totalPlans}</td>
                  <td className="px-4 py-3 text-right text-sm text-success">{a.completedPlans}</td>
                  <td className="px-4 py-3 text-right text-sm text-error">{a.overduePlans}</td>
                  <td className="px-4 py-3 text-right text-sm text-muted">{a.avgResolutionDays !== null ? `${a.avgResolutionDays}d` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
})
