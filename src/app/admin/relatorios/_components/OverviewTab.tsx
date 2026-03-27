'use client'

import { memo } from 'react'
import {
  FiAlertTriangle, FiCheckCircle, FiClipboard, FiMapPin, FiUsers,
} from 'react-icons/fi'
import { formatMinutes } from '@/lib/adherenceCalculations'
import type { SectorStats, RequiredAction, Period } from '../_types'
import { CardExportDropdown } from './CardExportDropdown'

// ── Types (inferred from adherenceCalculations return shapes) ─────────────────

type StatusBreakdown = {
  total: number; concluido: number; validado: number
  em_andamento: number; incompleto: number; rascunho: number
}

type OverallMetrics = {
  completionRate: number
  inProgressRate: number
  abandonRate: number
  statusBreakdown: StatusBreakdown
}

type AdherenceMetrics = {
  completionRate: number
  statusBreakdown: StatusBreakdown
}

type TemplateAdherenceRow = {
  templateId: number
  templateName: string
  metrics: AdherenceMetrics
  storesWithZero: number
}

type StoreAdherenceRow = {
  storeId: number
  storeName: string
  metrics: AdherenceMetrics
  templatesNeverFilled: string[]
}

type UserAdherenceRow = {
  userId: string
  userName: string
  metrics: AdherenceMetrics
  avgCompletionTimeMinutes: number | null
}

type CoverageGap = { templateName: string; storeName: string }

type DailyStatusStat = {
  date: string; total: number
  validado: number; concluido: number; em_andamento: number; incompleto: number; rascunho: number
}

type AttentionPoint = { text: string; severity: 'error' | 'warning' }

type Props = {
  // Computed metrics
  overallMetrics: OverallMetrics | null
  sortedTemplateAdherence: TemplateAdherenceRow[]
  sortedStoreAdherence: StoreAdherenceRow[]
  sortedUserAdherence: UserAdherenceRow[]
  coverageGaps: CoverageGap[]
  dailyStatusStats: DailyStatusStat[]
  avgCompletionTime: number | null
  attentionPoints: AttentionPoint[]
  summaryText: string
  // Raw data for filters
  rawStores: { id: number; name: string }[]
  sectorStats: SectorStats[]
  requiredActions: RequiredAction[]
  // Period + store filter
  period: Period
  setPeriod: (p: Period) => void
  overviewFilterStore: string
  setOverviewFilterStore: (v: string) => void
  // Advanced filters
  showAdvancedFilters: boolean
  setShowAdvancedFilters: (v: boolean | ((prev: boolean) => boolean)) => void
  hiddenUserIds: Set<string>
  setHiddenUserIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  hiddenStoreIds: Set<number>
  setHiddenStoreIds: (v: Set<number> | ((prev: Set<number>) => Set<number>)) => void
  hiddenTemplateIds: Set<number>
  setHiddenTemplateIds: (v: Set<number> | ((prev: Set<number>) => Set<number>)) => void
  allUsers: { id: string; name: string; email: string }[]
  allStoresSimple: { id: number; name: string }[]
  allTemplatesSimple: { id: number; name: string }[]
  // Sort controls
  templateSort: 'best' | 'worst' | 'name'
  setTemplateSort: (v: 'best' | 'worst' | 'name') => void
  storeSort: 'best' | 'worst' | 'name'
  setStoreSort: (v: 'best' | 'worst' | 'name') => void
  userSort: 'best' | 'worst' | 'name'
  setUserSort: (v: 'best' | 'worst' | 'name') => void
  showAllGaps: boolean
  setShowAllGaps: (v: boolean) => void
  // Card export
  cardExportMenu: string | null
  setCardExportMenu: (v: string | null) => void
  handleCardExport: (cardType: 'template' | 'store' | 'user', format: 'csv' | 'txt' | 'xlsx' | 'pdf') => void
  canExportExcel: boolean
  canExportPdf: boolean
  // Top-level export dropdown (rendered by parent)
  exportDropdownNode: React.ReactNode
}

export const OverviewTab = memo(function OverviewTab({
  overallMetrics, sortedTemplateAdherence, sortedStoreAdherence, sortedUserAdherence,
  coverageGaps, dailyStatusStats, avgCompletionTime, attentionPoints, summaryText,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rawStores, sectorStats, requiredActions,
  period, setPeriod, overviewFilterStore, setOverviewFilterStore,
  showAdvancedFilters, setShowAdvancedFilters,
  hiddenUserIds, setHiddenUserIds, hiddenStoreIds, setHiddenStoreIds, hiddenTemplateIds, setHiddenTemplateIds,
  allUsers, allStoresSimple, allTemplatesSimple,
  templateSort, setTemplateSort, storeSort, setStoreSort, userSort, setUserSort,
  showAllGaps, setShowAllGaps,
  cardExportMenu, setCardExportMenu, handleCardExport,
  canExportExcel, canExportPdf,
  exportDropdownNode,
}: Props) {
  const totalHidden = hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size

  return (
    <>
      {/* Period + store filters */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-main">Visao Geral</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={overviewFilterStore}
            onChange={e => setOverviewFilterStore(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Todas as lojas</option>
            {rawStores.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
          </select>
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
          <button
            onClick={() => setShowAdvancedFilters(v => !v)}
            className={`relative px-4 py-2 rounded-xl font-medium transition-colors text-sm ${showAdvancedFilters ? 'btn-primary' : 'btn-secondary'}`}
          >
            Filtros Avancados
            {totalHidden > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-warning text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {totalHidden}
              </span>
            )}
          </button>
          {exportDropdownNode}
        </div>
      </div>

      {/* Advanced filters panel */}
      {showAdvancedFilters && (
        <div className="mb-6 p-4 bg-surface border border-subtle rounded-xl flex flex-col gap-4">
          {/* Hide users */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Usuarios do relatorio</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={e => { if (!e.target.value) return; setHiddenUserIds(prev => new Set([...prev, e.target.value])) }}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-hover border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecionar usuario...</option>
                {allUsers.filter(u => !hiddenUserIds.has(u.id)).map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
              {[...hiddenUserIds].map(uid => {
                const u = allUsers.find(x => x.id === uid)
                return (
                  <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/30">
                    {u ? (u.name || u.email) : uid}
                    <button onClick={() => setHiddenUserIds(prev => { const s = new Set(prev); s.delete(uid); return s })} className="hover:text-error transition-colors">×</button>
                  </span>
                )
              })}
            </div>
          </div>

          {/* Hide stores */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Lojas do relatorio</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={e => { if (!e.target.value) return; setHiddenStoreIds(prev => new Set([...prev, Number(e.target.value)])) }}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-hover border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecionar loja...</option>
                {allStoresSimple.filter(s => !hiddenStoreIds.has(s.id)).map(s => (
                  <option key={s.id} value={String(s.id)}>{s.name}</option>
                ))}
              </select>
              {[...hiddenStoreIds].map(sid => {
                const s = allStoresSimple.find(x => x.id === sid)
                return (
                  <span key={sid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/30">
                    {s ? s.name : `Loja #${sid}`}
                    <button onClick={() => setHiddenStoreIds(prev => { const set = new Set(prev); set.delete(sid); return set })} className="hover:text-error transition-colors">×</button>
                  </span>
                )
              })}
            </div>
          </div>

          {/* Hide templates */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Templates do relatorio</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value=""
                onChange={e => { if (!e.target.value) return; setHiddenTemplateIds(prev => new Set([...prev, Number(e.target.value)])) }}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-hover border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecionar template...</option>
                {allTemplatesSimple.filter(t => !hiddenTemplateIds.has(t.id)).map(t => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
              {[...hiddenTemplateIds].map(tid => {
                const t = allTemplatesSimple.find(x => x.id === tid)
                return (
                  <span key={tid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning/10 text-warning text-xs font-medium rounded-full border border-warning/30">
                    {t ? t.name : `Template #${tid}`}
                    <button onClick={() => setHiddenTemplateIds(prev => { const s = new Set(prev); s.delete(tid); return s })} className="hover:text-error transition-colors">×</button>
                  </span>
                )
              })}
            </div>
          </div>

          {totalHidden > 0 && (
            <div className="pt-2 border-t border-subtle">
              <button
                onClick={() => { setHiddenUserIds(new Set()); setHiddenStoreIds(new Set()); setHiddenTemplateIds(new Set()) }}
                className="text-xs text-muted hover:text-error transition-colors underline underline-offset-2"
              >
                Limpar ocultacoes ({totalHidden} {totalHidden === 1 ? 'item oculto' : 'itens ocultos'})
              </button>
            </div>
          )}
        </div>
      )}

      {/* Executive summary */}
      {summaryText && (
        <div className="border-l-4 border-primary bg-surface rounded-r-xl px-5 py-4 mb-6">
          <p className="text-sm text-main leading-relaxed">{summaryText}</p>
        </div>
      )}

      {/* KPI cards */}
      {overallMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <div className={`card p-4 border-l-4 ${overallMetrics.completionRate >= 70 ? 'border-l-success' : overallMetrics.completionRate >= 40 ? 'border-l-warning' : 'border-l-error'}`}>
            <p className="text-xs text-muted mb-1">Taxa de Conclusao</p>
            <p className="text-3xl font-bold text-main">{overallMetrics.completionRate}%</p>
            <p className="text-[10px] text-muted mt-1">{overallMetrics.statusBreakdown.concluido + overallMetrics.statusBreakdown.validado} de {overallMetrics.statusBreakdown.total}</p>
          </div>
          <div className="card p-4 border-l-4 border-l-warning">
            <p className="text-xs text-muted mb-1">Em Andamento</p>
            <p className="text-3xl font-bold text-warning">{overallMetrics.statusBreakdown.em_andamento}</p>
            <p className="text-[10px] text-muted mt-1">{overallMetrics.inProgressRate}% do total</p>
          </div>
          <div className="card p-4 border-l-4 border-l-error">
            <p className="text-xs text-muted mb-1">Incompletos</p>
            <p className="text-3xl font-bold text-error">{overallMetrics.statusBreakdown.incompleto}</p>
            <p className="text-[10px] text-muted mt-1">{overallMetrics.abandonRate}% abandonados</p>
          </div>
          <div className="card p-4 border-l-4 border-l-[var(--border-subtle)]">
            <p className="text-xs text-muted mb-1">Rascunhos</p>
            <p className="text-3xl font-bold text-muted">{overallMetrics.statusBreakdown.rascunho}</p>
            <p className="text-[10px] text-muted mt-1">Não iniciados</p>
          </div>
          <div className="card p-4 border-l-4 border-l-primary">
            <p className="text-xs text-muted mb-1">Tempo Medio</p>
            <p className="text-3xl font-bold text-primary">{formatMinutes(avgCompletionTime)}</p>
            <p className="text-[10px] text-muted mt-1">Inicio ate conclusao</p>
          </div>
          <div className={`card p-4 border-l-4 ${coverageGaps.length > 0 ? 'border-l-error' : 'border-l-success'}`}>
            <p className="text-xs text-muted mb-1">Nao Preenchidos</p>
            <p className={`text-3xl font-bold ${coverageGaps.length > 0 ? 'text-error' : 'text-success'}`}>{coverageGaps.length}</p>
            <p className="text-[10px] text-muted mt-1">Checklists pendentes de preenchimento</p>
          </div>
        </div>
      )}

      {/* Status distribution bar */}
      {overallMetrics && overallMetrics.statusBreakdown.total > 0 && (() => {
        const sb = overallMetrics.statusBreakdown
        const t = sb.total
        const segments = [
          { key: 'validado',     label: 'Validado',     count: sb.validado,     color: 'bg-success',      textColor: 'text-success' },
          { key: 'concluido',    label: 'Concluído',    count: sb.concluido,    color: 'bg-primary',      textColor: 'text-primary' },
          { key: 'em_andamento', label: 'Em Andamento', count: sb.em_andamento, color: 'bg-warning',      textColor: 'text-warning' },
          { key: 'incompleto',   label: 'Incompleto',   count: sb.incompleto,   color: 'bg-error',        textColor: 'text-error'   },
          { key: 'rascunho',     label: 'Rascunho',     count: sb.rascunho,     color: 'bg-surface-hover', textColor: 'text-muted'  },
        ].filter(s => s.count > 0)
        return (
          <div className="card p-5 mb-6">
            <h3 className="text-sm font-semibold text-main mb-3">Distribuicao de Status</h3>
            <div className="h-6 rounded-full overflow-hidden flex">
              {segments.map(s => (
                <div key={s.key} className={`${s.color} transition-all`} style={{ width: `${(s.count / t) * 100}%` }} title={`${s.label}: ${s.count} (${Math.round((s.count / t) * 100)}%)`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {segments.map(s => (
                <div key={s.key} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-xs text-muted">{s.label}: <span className={`font-semibold ${s.textColor}`}>{s.count}</span> ({Math.round((s.count / t) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Attention points + required actions */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-warning uppercase tracking-wide mb-4">
            <FiAlertTriangle className="w-5 h-5" /> Pontos de Atencao
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {attentionPoints.length === 0 ? (
              <div className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3">
                <p className="text-sm text-muted">Nenhum ponto de atencao no periodo</p>
              </div>
            ) : attentionPoints.map((p, i) => (
              <div key={i} className={`border-l-4 ${p.severity === 'error' ? 'border-error' : 'border-warning'} bg-surface rounded-r-xl px-4 py-3`}>
                <p className="text-sm text-main">{p.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-success uppercase tracking-wide mb-4">
            <FiCheckCircle className="w-5 h-5" /> Acoes Necessarias
          </h3>
          <div className="space-y-3">
            {requiredActions.length === 0 ? (
              <div className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3">
                <p className="text-sm text-muted">Nenhuma acao pendente</p>
              </div>
            ) : requiredActions.map((a, i) => (
              <div key={i} className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3 flex items-center justify-between gap-2">
                <p className="text-sm text-main flex-1">{a.text}</p>
                <span className="text-xs text-muted whitespace-nowrap">{a.responsible}</span>
                <span className={`text-xs text-white px-2 py-1 rounded whitespace-nowrap ${a.deadlineColor}`}>{a.deadline}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily stacked chart */}
      <div className="card p-6 mb-8">
        <h3 className="text-lg font-semibold text-main mb-2">Checklists por Dia</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: 'Validado', color: 'bg-success' }, { label: 'Concluído', color: 'bg-primary' },
            { label: 'Em Andamento', color: 'bg-warning' }, { label: 'Incompleto', color: 'bg-error' },
            { label: 'Rascunho', color: 'bg-surface-hover' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1 text-[10px] text-muted">
              <span className={`w-2 h-2 rounded-full ${l.color}`} />{l.label}
            </span>
          ))}
        </div>
        {(() => {
          const maxDay = Math.max(...dailyStatusStats.map(d => d.total), 1)
          return (
            <div className="h-48 flex items-end gap-1">
              {dailyStatusStats.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: ${day.total} total`}>
                  <div className="w-full flex flex-col-reverse" style={{ height: `${(day.total / maxDay) * 100}%`, minHeight: day.total > 0 ? '4px' : '0' }}>
                    {day.rascunho > 0 && <div className="w-full bg-surface-hover" style={{ flex: day.rascunho }} />}
                    {day.incompleto > 0 && <div className="w-full bg-error" style={{ flex: day.incompleto }} />}
                    {day.em_andamento > 0 && <div className="w-full bg-warning" style={{ flex: day.em_andamento }} />}
                    {day.concluido > 0 && <div className="w-full bg-primary" style={{ flex: day.concluido }} />}
                    {day.validado > 0 && <div className="w-full bg-success rounded-t" style={{ flex: day.validado }} />}
                  </div>
                  {index % 5 === 0 && <span className="text-[10px] text-muted">{day.date}</span>}
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Adherence by template */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
          <h3 className="font-semibold text-main flex items-center gap-2"><FiClipboard className="w-4 h-4" /> Adesao por Template</h3>
          <div className="flex gap-1 ml-auto">
            {(['worst', 'best', 'name'] as const).map(s => (
              <button key={s} onClick={() => setTemplateSort(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${templateSort === s ? s === 'worst' ? 'bg-error/20 text-error' : s === 'best' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>
                {s === 'worst' ? 'Pior primeiro' : s === 'best' ? 'Melhor primeiro' : 'A-Z'}
              </button>
            ))}
          </div>
          <CardExportDropdown
            cardType="template"
            isOpen={cardExportMenu === 'template'}
            onToggle={() => setCardExportMenu(cardExportMenu === 'template' ? null : 'template')}
            canExportExcel={canExportExcel}
            canExportPdf={canExportPdf}
            onExport={fmt => handleCardExport('template', fmt)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted">Template</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Total</th>
                <th className="px-3 py-3 text-right font-medium text-success">Valid.</th>
                <th className="px-3 py-3 text-right font-medium text-primary">Concl.</th>
                <th className="px-3 py-3 text-right font-medium text-warning">Andam.</th>
                <th className="px-3 py-3 text-right font-medium text-error">Incomp.</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Rasc.</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Taxa</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Lacunas</th>
                <th className="px-4 py-3 font-medium text-muted min-w-[120px]">Barra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {sortedTemplateAdherence.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted">Nenhum dado</td></tr>
              ) : sortedTemplateAdherence.map(t => {
                const sb = t.metrics.statusBreakdown
                const total = sb.total || 1
                return (
                  <tr key={t.templateId} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-main">{t.templateName}</td>
                    <td className="px-3 py-3 text-right text-main">{sb.total}</td>
                    <td className="px-3 py-3 text-right text-success">{sb.validado || '-'}</td>
                    <td className="px-3 py-3 text-right text-primary">{sb.concluido || '-'}</td>
                    <td className="px-3 py-3 text-right text-warning">{sb.em_andamento || '-'}</td>
                    <td className="px-3 py-3 text-right text-error">{sb.incompleto || '-'}</td>
                    <td className="px-3 py-3 text-right text-muted">{sb.rascunho || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${t.metrics.completionRate >= 80 ? 'bg-success/20 text-success' : t.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
                        {t.metrics.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.storesWithZero > 0 ? <span className="text-xs text-error font-medium">{t.storesWithZero} loja{t.storesWithZero > 1 ? 's' : ''}</span> : <span className="text-xs text-muted">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-2 rounded-full overflow-hidden flex bg-subtle">
                        {sb.validado > 0 && <div className="bg-success" style={{ width: `${(sb.validado / total) * 100}%` }} />}
                        {sb.concluido > 0 && <div className="bg-primary" style={{ width: `${(sb.concluido / total) * 100}%` }} />}
                        {sb.em_andamento > 0 && <div className="bg-warning" style={{ width: `${(sb.em_andamento / total) * 100}%` }} />}
                        {sb.incompleto > 0 && <div className="bg-error" style={{ width: `${(sb.incompleto / total) * 100}%` }} />}
                        {sb.rascunho > 0 && <div className="bg-surface-hover" style={{ width: `${(sb.rascunho / total) * 100}%` }} />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adherence by store */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
          <h3 className="font-semibold text-main flex items-center gap-2"><FiMapPin className="w-4 h-4" /> Adesao por Loja</h3>
          <div className="flex gap-1 ml-auto">
            {(['worst', 'best', 'name'] as const).map(s => (
              <button key={s} onClick={() => setStoreSort(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${storeSort === s ? s === 'worst' ? 'bg-error/20 text-error' : s === 'best' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>
                {s === 'worst' ? 'Pior primeiro' : s === 'best' ? 'Melhor primeiro' : 'A-Z'}
              </button>
            ))}
          </div>
          <CardExportDropdown
            cardType="store"
            isOpen={cardExportMenu === 'store'}
            onToggle={() => setCardExportMenu(cardExportMenu === 'store' ? null : 'store')}
            canExportExcel={canExportExcel}
            canExportPdf={canExportPdf}
            onExport={fmt => handleCardExport('store', fmt)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted">Loja</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Total</th>
                <th className="px-3 py-3 text-right font-medium text-success">Valid.</th>
                <th className="px-3 py-3 text-right font-medium text-primary">Concl.</th>
                <th className="px-3 py-3 text-right font-medium text-warning">Andam.</th>
                <th className="px-3 py-3 text-right font-medium text-error">Incomp.</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Rasc.</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Taxa</th>
                <th className="px-4 py-3 text-center font-medium text-muted">Faltando</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {sortedStoreAdherence.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted">Nenhum dado</td></tr>
              ) : sortedStoreAdherence.map(s => {
                const sb = s.metrics.statusBreakdown
                return (
                  <tr key={s.storeId} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-main">{s.storeName}</td>
                    <td className="px-3 py-3 text-right text-main">{sb.total}</td>
                    <td className="px-3 py-3 text-right text-success">{sb.validado || '-'}</td>
                    <td className="px-3 py-3 text-right text-primary">{sb.concluido || '-'}</td>
                    <td className="px-3 py-3 text-right text-warning">{sb.em_andamento || '-'}</td>
                    <td className="px-3 py-3 text-right text-error">{sb.incompleto || '-'}</td>
                    <td className="px-3 py-3 text-right text-muted">{sb.rascunho || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${s.metrics.completionRate >= 80 ? 'bg-success/20 text-success' : s.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
                        {s.metrics.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {s.templatesNeverFilled.length > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-error/20 text-error cursor-help" title={s.templatesNeverFilled.join('\n')}>
                          {s.templatesNeverFilled.length}
                        </span>
                      ) : <span className="text-xs text-muted">-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adherence by user */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
          <h3 className="font-semibold text-main flex items-center gap-2"><FiUsers className="w-4 h-4" /> Adesao por Usuario</h3>
          <div className="flex gap-1 ml-auto">
            {(['worst', 'best', 'name'] as const).map(s => (
              <button key={s} onClick={() => setUserSort(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${userSort === s ? s === 'worst' ? 'bg-error/20 text-error' : s === 'best' ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>
                {s === 'worst' ? 'Pior primeiro' : s === 'best' ? 'Melhor primeiro' : 'A-Z'}
              </button>
            ))}
          </div>
          <CardExportDropdown
            cardType="user"
            isOpen={cardExportMenu === 'user'}
            onToggle={() => setCardExportMenu(cardExportMenu === 'user' ? null : 'user')}
            canExportExcel={canExportExcel}
            canExportPdf={canExportPdf}
            onExport={fmt => handleCardExport('user', fmt)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted">Usuario</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Total</th>
                <th className="px-3 py-3 text-right font-medium text-success">Concl.</th>
                <th className="px-3 py-3 text-right font-medium text-warning">Andam.</th>
                <th className="px-3 py-3 text-right font-medium text-error">Incomp.</th>
                <th className="px-3 py-3 text-right font-medium text-muted">Rasc.</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Taxa</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Tempo Medio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {sortedUserAdherence.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Nenhum dado</td></tr>
              ) : sortedUserAdherence.map(u => {
                const sb = u.metrics.statusBreakdown
                return (
                  <tr key={u.userId} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-main">{u.userName}</td>
                    <td className="px-3 py-3 text-right text-main">{sb.total}</td>
                    <td className="px-3 py-3 text-right text-success">{sb.concluido + sb.validado || '-'}</td>
                    <td className="px-3 py-3 text-right text-warning">{sb.em_andamento || '-'}</td>
                    <td className="px-3 py-3 text-right text-error">{sb.incompleto || '-'}</td>
                    <td className="px-3 py-3 text-right text-muted">{sb.rascunho || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${u.metrics.completionRate >= 80 ? 'bg-success/20 text-success' : u.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' : 'bg-error/20 text-error'}`}>
                        {u.metrics.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{formatMinutes(u.avgCompletionTimeMinutes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coverage gaps */}
      {coverageGaps.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-subtle">
            <h3 className="font-semibold text-main flex items-center gap-2">
              <FiAlertTriangle className="w-4 h-4 text-error" /> Checklists Nao Preenchidos
            </h3>
            <p className="text-xs text-muted mt-1">Combinacoes de template + loja que deveriam ter sido preenchidas no periodo mas nao foram</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-hover">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted">Template</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Loja</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {(showAllGaps ? coverageGaps : coverageGaps.slice(0, 20)).map((g, i) => (
                  <tr key={i} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 font-medium text-main">{g.templateName}</td>
                    <td className="px-4 py-3 text-secondary">{g.storeName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-error/20 text-error">Nunca preenchido</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coverageGaps.length > 20 && !showAllGaps && (
            <div className="px-6 py-3 border-t border-subtle">
              <button onClick={() => setShowAllGaps(true)} className="text-xs text-primary hover:underline">
                Ver todos ({coverageGaps.length} nao preenchidos)
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
})
