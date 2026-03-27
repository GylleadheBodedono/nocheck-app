'use client'

import { memo, useMemo } from 'react'
import type { ComplianceSummary, FieldComplianceRow, StoreComplianceRow, HeatmapCell } from '@/lib/analyticsQueries'
import type { Period } from '../_types'

type Props = {
  period: Period
  setPeriod: (p: Period) => void
  complianceSummary: ComplianceSummary
  complianceByField: FieldComplianceRow[]
  complianceByStore: StoreComplianceRow[]
  heatmapData: { cells: HeatmapCell[]; stores: string[]; fields: string[] }
  exportDropdownNode: React.ReactNode
}

export const ConformidadeTab = memo(function ConformidadeTab({
  period, setPeriod,
  complianceSummary, complianceByField, complianceByStore, heatmapData,
  exportDropdownNode,
}: Props) {
  // Computed once for the entire heatmap render, not once per store row
  const heatmapMaxCount = useMemo(
    () => Math.max(...heatmapData.cells.map(c => c.count), 1),
    [heatmapData.cells]
  )

  // Pre-index cells by "storeName|fieldName" to avoid O(n) find per cell
  const heatmapIndex = useMemo(() => {
    const idx = new Map<string, number>()
    for (const cell of heatmapData.cells) {
      idx.set(`${cell.storeName}|${cell.fieldName}`, cell.count)
    }
    return idx
  }, [heatmapData.cells])

  return (
    <div>
      {/* Period filter */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-main">Conformidade</h2>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-2xl font-bold text-main">{complianceSummary.totalNonConformities}</p>
          <p className="text-xs text-muted">Nao Conformidades</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-success">{complianceSummary.complianceRate}%</p>
          <p className="text-xs text-muted">Taxa Conformidade</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-main">{complianceSummary.plansCreated}</p>
          <p className="text-xs text-muted">Planos Criados</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-success">{complianceSummary.plansResolved}</p>
          <p className="text-xs text-muted">Resolvidos</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-error">{complianceSummary.plansOverdue}</p>
          <p className="text-xs text-muted">Vencidos</p>
        </div>
      </div>

      {/* By field table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-subtle">
          <h3 className="font-semibold text-main">Nao Conformidades por Campo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Campo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Template</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Total</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Resolvidos</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {complianceByField.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Nenhum dado disponivel</td></tr>
              ) : complianceByField.map(row => (
                <tr key={row.fieldId} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3 font-medium text-main text-sm">{row.fieldName}</td>
                  <td className="px-4 py-3 text-sm text-secondary">{row.templateName}</td>
                  <td className="px-4 py-3 text-right text-sm text-main">{row.totalPlans}</td>
                  <td className="px-4 py-3 text-right text-sm text-success">{row.resolvedPlans}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${
                      row.complianceRate >= 80 ? 'bg-success/20 text-success' :
                      row.complianceRate >= 50 ? 'bg-warning/20 text-warning' :
                      'bg-error/20 text-error'
                    }`}>{row.complianceRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By store + heatmap side by side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Store ranking */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-subtle">
            <h3 className="font-semibold text-main">Ranking por Loja</h3>
          </div>
          <div className="divide-y divide-subtle">
            {complianceByStore.length === 0 ? (
              <div className="px-6 py-8 text-center text-muted">Nenhum dado</div>
            ) : complianceByStore.map(store => (
              <div key={store.storeId} className="px-6 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors">
                <div>
                  <p className="font-medium text-main">{store.storeName}</p>
                  <p className="text-xs text-muted">{store.totalPlans} nao conformidades, {store.overduePlans} vencidos</p>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  store.rate >= 80 ? 'bg-success/20 text-success' :
                  store.rate >= 50 ? 'bg-warning/20 text-warning' :
                  'bg-error/20 text-error'
                }`}>{store.rate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap — maxCount and index pre-computed outside render loop */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-subtle">
            <h3 className="font-semibold text-main">Heatmap Loja x Campo</h3>
          </div>
          <div className="p-4 overflow-x-auto">
            {heatmapData.stores.length === 0 ? (
              <div className="text-center text-muted py-8">Nenhum dado</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-left text-muted font-medium">Loja</th>
                    {heatmapData.fields.map(f => (
                      <th key={f} className="px-2 py-1 text-center text-muted font-medium max-w-[80px] truncate" title={f}>{f}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.stores.map(store => (
                    <tr key={store}>
                      <td className="px-2 py-1 font-medium text-main whitespace-nowrap">{store}</td>
                      {heatmapData.fields.map(field => {
                        const count = heatmapIndex.get(`${store}|${field}`) ?? 0
                        const intensity = count / heatmapMaxCount
                        const bg = count === 0 ? 'bg-success/10' :
                          intensity > 0.66 ? 'bg-error/40' :
                          intensity > 0.33 ? 'bg-warning/40' :
                          'bg-warning/20'
                        return (
                          <td key={field} className={`px-2 py-1 text-center ${bg} rounded`} title={`${store} - ${field}: ${count}`}>
                            {count > 0 ? count : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
