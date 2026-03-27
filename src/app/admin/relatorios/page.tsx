'use client'

/**
 * /admin/relatorios — main entry point.
 *
 * Responsibilities of this file (thin orchestrator):
 *  1. Fetch all report data via useReportData()
 *  2. Derive adherence metrics with useMemo (reactive to filter changes)
 *  3. Own UI filter state via useReportFilters()
 *  4. Own export handler functions via useExportState()
 *  5. Route the active tab to the correct tab component
 *
 * All rendering is delegated to components in ./_components/.
 * All data fetching lives in ./_hooks/useReportData.ts.
 */

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { FiBarChart2, FiUsers, FiAlertTriangle, FiRepeat, FiCamera, FiClipboard, FiWifiOff } from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { useFeature } from '@/hooks/useFeature'
import { logError } from '@/lib/clientLogger'
import { LoadingPage, PageContainer } from '@/components/ui'
import {
  computeOverallAdherence, computeTemplateAdherence, computeStoreAdherence,
  computeUserAdherence, computeCoverageGaps, computeDailyStatusStats,
  computeAvgCompletionTime, generateEnhancedAttentionPoints,
} from '@/lib/adherenceCalculations'
import {
  exportOverviewToCSV, exportOverviewToTXT, exportOverviewToExcel, exportOverviewToPDF,
  exportResponsesToCSV, exportResponsesToTXT, exportResponsesToExcel, exportResponsesToPDF,
  exportComplianceToCSV, exportComplianceToTXT, exportComplianceToExcel, exportComplianceToPDF,
  exportReincidenciasToCSV, exportReincidenciasToTXT, exportReincidenciasToExcel, exportReincidenciasToPDF,
  exportTemplateAdherenceToCSV, exportTemplateAdherenceToTXT, exportTemplateAdherenceToExcel, exportTemplateAdherenceToPDF,
  exportStoreAdherenceToCSV, exportStoreAdherenceToTXT, exportStoreAdherenceToExcel, exportStoreAdherenceToPDF,
  exportUserAdherenceToCSV, exportUserAdherenceToTXT, exportUserAdherenceToExcel, exportUserAdherenceToPDF,
  exportChecklistDetailToPDF, type ChecklistFieldResponse,
} from '@/lib/exportUtils'

import type { ActiveTab, UserChecklist } from './_types'
import { useReportData } from './_hooks/useReportData'
import { useReportFilters } from './_hooks/useReportFilters'
import { useExportState } from './_hooks/useExportState'
import { ExportDropdown } from './_components/ExportDropdown'
import { LogsModal } from './_components/LogsModal'
import { OverviewTab } from './_components/OverviewTab'
import { ResponsesTab } from './_components/ResponsesTab'
import { ConformidadeTab } from './_components/ConformidadeTab'
import { ReincidenciasTab } from './_components/ReincidenciasTab'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { hasFeature } = useFeature()
  const canExportPdf = hasFeature('export_pdf')
  const canExportExcel = hasFeature('export_excel')

  // ── Filter / UI state ───────────────────────────────────────────────────────
  const filters = useReportFilters()
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

  // ── Export state ────────────────────────────────────────────────────────────
  const exportState = useExportState(activeTab)

  // ── Logs modal state ────────────────────────────────────────────────────────
  const [logsModal, setLogsModal] = useState<{
    open: boolean; label: string
    logs: { id: number; action: string; created_at: string; user_id: string | null; details: Record<string, unknown> | null }[]
  }>({ open: false, label: '', logs: [] })
  const [logsLoading, setLogsLoading] = useState(false)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const {
    coreLoading, analyticsLoading, isOffline, fetchError, dataWarning,
    summary, storeStats, templateStats, dailyStats,
    sectorStats, requiredActions, rawActiveChecklists, rawTemplates, rawStores,
    rawUsers, rawVisibility, rawChartDays, rawOverdueCount,
    userChecklists, allUsers, allStoresSimple, allTemplatesSimple,
    complianceSummary, complianceByField, complianceByStore, heatmapData,
    reincSummary, reincRows, assigneeStats, supabase,
  } = useReportData(filters.period)

  // ── Adherence memos (recompute only when raw data or filters change) ─────────

  const filteredChecklists = useMemo(() => rawActiveChecklists.filter(c => {
    if (filters.overviewFilterStore && c.store_id !== Number(filters.overviewFilterStore)) return false
    if (filters.hiddenStoreIds.size > 0 && filters.hiddenStoreIds.has(c.store_id)) return false
    if (filters.hiddenUserIds.size > 0 && filters.hiddenUserIds.has(c.created_by)) return false
    if (filters.hiddenTemplateIds.size > 0 && filters.hiddenTemplateIds.has(c.template_id)) return false
    return true
  }), [rawActiveChecklists, filters.overviewFilterStore, filters.hiddenStoreIds, filters.hiddenUserIds, filters.hiddenTemplateIds])

  const overallMetrics = useMemo(() => {
    if (filteredChecklists.length === 0 && rawActiveChecklists.length === 0) return null
    return computeOverallAdherence(filteredChecklists)
  }, [filteredChecklists, rawActiveChecklists.length])

  const templateAdherence = useMemo(() => {
    const vis = filters.overviewFilterStore ? rawVisibility.filter(v => v.store_id === Number(filters.overviewFilterStore)) : rawVisibility
    const templates = filters.hiddenTemplateIds.size > 0 ? rawTemplates.filter(t => !filters.hiddenTemplateIds.has(t.id)) : rawTemplates
    return computeTemplateAdherence(filteredChecklists, templates, vis)
  }, [filteredChecklists, rawTemplates, rawVisibility, filters.overviewFilterStore, filters.hiddenTemplateIds])

  const storeAdherence = useMemo(() => {
    let stores = filters.overviewFilterStore ? rawStores.filter(s => s.id === Number(filters.overviewFilterStore)) : rawStores
    if (filters.hiddenStoreIds.size > 0) stores = stores.filter(s => !filters.hiddenStoreIds.has(s.id))
    return computeStoreAdherence(filteredChecklists, stores, rawTemplates, rawVisibility)
  }, [filteredChecklists, rawStores, rawTemplates, rawVisibility, filters.overviewFilterStore, filters.hiddenStoreIds])

  const userAdherence = useMemo(() => {
    const users = filters.hiddenUserIds.size > 0 ? rawUsers.filter(u => !filters.hiddenUserIds.has(u.id)) : rawUsers
    return computeUserAdherence(filteredChecklists, users)
  }, [filteredChecklists, rawUsers, filters.hiddenUserIds])

  const coverageGaps = useMemo(() => {
    let stores = filters.overviewFilterStore ? rawStores.filter(s => s.id === Number(filters.overviewFilterStore)) : rawStores
    if (filters.hiddenStoreIds.size > 0) stores = stores.filter(s => !filters.hiddenStoreIds.has(s.id))
    let vis = filters.overviewFilterStore ? rawVisibility.filter(v => v.store_id === Number(filters.overviewFilterStore)) : rawVisibility
    if (filters.hiddenStoreIds.size > 0) vis = vis.filter(v => !filters.hiddenStoreIds.has(v.store_id))
    if (filters.hiddenTemplateIds.size > 0) vis = vis.filter(v => !filters.hiddenTemplateIds.has(v.template_id))
    const templates = filters.hiddenTemplateIds.size > 0 ? rawTemplates.filter(t => !filters.hiddenTemplateIds.has(t.id)) : rawTemplates
    return computeCoverageGaps(filteredChecklists, templates, stores, vis)
  }, [filteredChecklists, rawTemplates, rawStores, rawVisibility, filters.overviewFilterStore, filters.hiddenStoreIds, filters.hiddenTemplateIds])

  const dailyStatusStats = useMemo(() => computeDailyStatusStats(filteredChecklists, rawChartDays), [filteredChecklists, rawChartDays])
  const avgCompletionTime = useMemo(() => computeAvgCompletionTime(filteredChecklists), [filteredChecklists])

  const attentionPoints = useMemo(() => {
    if (rawActiveChecklists.length === 0 && filteredChecklists.length === 0) return []
    const unusedTemplateNames = rawTemplates
      .filter(t => !filteredChecklists.some(c => c.template_id === t.id))
      .filter(t => !rawVisibility.some(v => v.template_id === t.id))
      .map(t => t.name)
    return generateEnhancedAttentionPoints(storeAdherence, templateAdherence, coverageGaps, rawOverdueCount, unusedTemplateNames)
  }, [filteredChecklists, rawActiveChecklists.length, rawTemplates, rawVisibility, storeAdherence, templateAdherence, coverageGaps, rawOverdueCount])

  const summaryText = useMemo(() => {
    if (!overallMetrics) return ''
    const sb = overallMetrics.statusBreakdown
    if (sb.total === 0) return 'Nenhum checklist registrado no periodo selecionado.'
    let text = `Adesao geral: ${overallMetrics.completionRate}% concluidos.`
    const parts: string[] = []
    if (sb.em_andamento > 0) parts.push(`${sb.em_andamento} em andamento`)
    if (sb.incompleto > 0) parts.push(`${sb.incompleto} incompleto${sb.incompleto > 1 ? 's' : ''}`)
    if (sb.rascunho > 0) parts.push(`${sb.rascunho} rascunho${sb.rascunho > 1 ? 's' : ''}`)
    if (parts.length > 0) text += ` ${parts.join(', ')}.`
    if (coverageGaps.length > 0) text += ` ${coverageGaps.length} checklist${coverageGaps.length > 1 ? 's' : ''} nao preenchido${coverageGaps.length > 1 ? 's' : ''}.`
    if (!filters.overviewFilterStore && sectorStats.length > 1) {
      const best = sectorStats[0]
      const worst = sectorStats[sectorStats.length - 1]
      if (!(best.completion_rate === 0 && worst.completion_rate === 0) && best.completion_rate !== worst.completion_rate && best.sector_id !== worst.sector_id) {
        text += ` Melhor setor: ${best.sector_name} (${best.completion_rate}%). Pior: ${worst.sector_name} (${worst.completion_rate}%).`
      }
    }
    return text
  }, [overallMetrics, coverageGaps, sectorStats, filters.overviewFilterStore])

  // ── Sorted adherence arrays ─────────────────────────────────────────────────

  const sortedTemplateAdherence = useMemo(() => {
    const arr = [...templateAdherence]
    if (filters.templateSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (filters.templateSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.templateName.localeCompare(b.templateName))
    return arr
  }, [templateAdherence, filters.templateSort])

  const sortedStoreAdherence = useMemo(() => {
    const arr = [...storeAdherence]
    if (filters.storeSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (filters.storeSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.storeName.localeCompare(b.storeName))
    return arr
  }, [storeAdherence, filters.storeSort])

  const sortedUserAdherence = useMemo(() => {
    const arr = [...userAdherence]
    if (filters.userSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (filters.userSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.userName.localeCompare(b.userName))
    return arr
  }, [userAdherence, filters.userSort])

  // ── Export handlers ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async (format: 'csv' | 'txt' | 'xlsx') => {
    exportState.setExportMenuOpen(false)
    exportState.setExporting(true)
    try {
      const ts = new Date().toISOString().split('T')[0]
      const tabName = activeTab === 'overview' ? 'visao_geral' : activeTab === 'responses' ? 'respostas' : activeTab === 'conformidade' ? 'conformidade' : 'reincidencias'
      const base = `relatorio_${tabName}_${ts}`
      if (activeTab === 'overview') {
        const data = { summary, storeStats, templateStats, dailyStats, period: filters.period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime }
        if (format === 'csv') exportOverviewToCSV(data, `${base}.csv`)
        else if (format === 'txt') exportOverviewToTXT(data, `${base}.txt`)
        else await exportOverviewToExcel(data, `${base}.xlsx`)
      } else if (activeTab === 'responses') {
        const filtered = userChecklists.filter(c => (!filters.responseFilterUser || c.created_by === filters.responseFilterUser) && (!filters.responseFilterStore || c.store_name === filters.responseFilterStore) && (!filters.responseFilterTemplate || c.template_name === filters.responseFilterTemplate))
        if (format === 'csv') exportResponsesToCSV(filtered, `${base}.csv`)
        else if (format === 'txt') exportResponsesToTXT(filtered, `${base}.txt`)
        else await exportResponsesToExcel(filtered, `${base}.xlsx`)
      } else if (activeTab === 'conformidade') {
        const data = { summary: complianceSummary, byField: complianceByField, byStore: complianceByStore }
        if (format === 'csv') exportComplianceToCSV(data, `${base}.csv`)
        else if (format === 'txt') exportComplianceToTXT(data, `${base}.txt`)
        else await exportComplianceToExcel(data, `${base}.xlsx`)
      } else {
        const data = { summary: reincSummary, rows: reincRows, assigneeStats }
        if (format === 'csv') exportReincidenciasToCSV(data, `${base}.csv`)
        else if (format === 'txt') exportReincidenciasToTXT(data, `${base}.txt`)
        else await exportReincidenciasToExcel(data, `${base}.xlsx`)
      }
    } catch (err) {
      logError('[Relatorios] Erro ao exportar', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      exportState.setExporting(false)
    }
  }, [activeTab, summary, storeStats, templateStats, dailyStats, filters.period, overallMetrics, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTime, userChecklists, filters.responseFilterUser, filters.responseFilterStore, filters.responseFilterTemplate, complianceSummary, complianceByField, complianceByStore, reincSummary, reincRows, assigneeStats, exportState])

  const handleExportPdf = useCallback(async () => {
    if (exportState.exportingPdf) return
    exportState.setExportMenuOpen(false)
    exportState.setExportingPdf(true)
    try {
      if (activeTab === 'overview') await exportOverviewToPDF({ summary, storeStats, templateStats, dailyStats, period: filters.period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime })
      else if (activeTab === 'responses') { const filtered = userChecklists.filter(c => (!filters.responseFilterUser || c.created_by === filters.responseFilterUser) && (!filters.responseFilterStore || c.store_name === filters.responseFilterStore) && (!filters.responseFilterTemplate || c.template_name === filters.responseFilterTemplate)); await exportResponsesToPDF(filtered) }
      else if (activeTab === 'conformidade') await exportComplianceToPDF({ summary: complianceSummary, byField: complianceByField, byStore: complianceByStore })
      else await exportReincidenciasToPDF({ summary: reincSummary, rows: reincRows, assigneeStats })
    } catch (err) {
      logError('[Relatorios] Erro ao exportar PDF', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      exportState.setExportingPdf(false)
    }
  }, [activeTab, exportState, summary, storeStats, templateStats, dailyStats, filters.period, overallMetrics, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTime, userChecklists, filters.responseFilterUser, filters.responseFilterStore, filters.responseFilterTemplate, complianceSummary, complianceByField, complianceByStore, reincSummary, reincRows, assigneeStats])

  const handleCardExport = useCallback(async (cardType: 'template' | 'store' | 'user', format: 'csv' | 'txt' | 'xlsx' | 'pdf') => {
    exportState.setCardExportMenu(null)
    const ts = new Date().toISOString().split('T')[0]
    if (cardType === 'template') {
      if (format === 'csv') exportTemplateAdherenceToCSV(sortedTemplateAdherence, filters.period, `adesao_template_${ts}.csv`)
      else if (format === 'txt') exportTemplateAdherenceToTXT(sortedTemplateAdherence, filters.period, `adesao_template_${ts}.txt`)
      else if (format === 'xlsx') await exportTemplateAdherenceToExcel(sortedTemplateAdherence, filters.period, `adesao_template_${ts}.xlsx`)
      else await exportTemplateAdherenceToPDF(sortedTemplateAdherence, filters.period)
    } else if (cardType === 'store') {
      if (format === 'csv') exportStoreAdherenceToCSV(sortedStoreAdherence, filters.period, `adesao_loja_${ts}.csv`)
      else if (format === 'txt') exportStoreAdherenceToTXT(sortedStoreAdherence, filters.period, `adesao_loja_${ts}.txt`)
      else if (format === 'xlsx') await exportStoreAdherenceToExcel(sortedStoreAdherence, filters.period, `adesao_loja_${ts}.xlsx`)
      else await exportStoreAdherenceToPDF(sortedStoreAdherence, filters.period)
    } else {
      if (format === 'csv') exportUserAdherenceToCSV(sortedUserAdherence, filters.period, `adesao_usuario_${ts}.csv`)
      else if (format === 'txt') exportUserAdherenceToTXT(sortedUserAdherence, filters.period, `adesao_usuario_${ts}.txt`)
      else if (format === 'xlsx') await exportUserAdherenceToExcel(sortedUserAdherence, filters.period, `adesao_usuario_${ts}.xlsx`)
      else await exportUserAdherenceToPDF(sortedUserAdherence, filters.period)
    }
  }, [sortedTemplateAdherence, sortedStoreAdherence, sortedUserAdherence, filters.period, exportState])

  const handleExportChecklistPDF = useCallback(async (c: UserChecklist) => {
    if (exportState.exportingChecklistId !== null) return
    exportState.setExportingChecklistId(c.id)
    try {
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('field_id, value_text, value_number, value_json, template_fields(name, field_type)')
        .eq('checklist_id', c.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: ChecklistFieldResponse[] = (responses || []).map((r: any) => {
        const vj = r.value_json as Record<string, unknown> | null
        let answer = '-'
        const photos: string[] = []
        if (r.value_text !== null && r.value_text !== '') { answer = r.value_text }
        else if (r.value_number !== null) { answer = String(r.value_number) }
        else if (vj !== null) {
          const ans = vj.answer !== undefined ? String(vj.answer) : ''
          const condText = vj.conditionalText ? String(vj.conditionalText) : ''
          answer = ans + (condText ? (ans ? ` — ${condText}` : condText) : '') || '-'
          photos.push(...((vj.photos as string[]) || []))
          photos.push(...((vj.conditionalPhotos as string[]) || []))
        }
        return { fieldName: r.template_fields?.name || `Campo ${r.field_id}`, fieldType: r.template_fields?.field_type || '', answer, photos }
      })
      await exportChecklistDetailToPDF({ userName: c.user_name, userEmail: c.user_email, storeName: c.store_name, templateName: c.template_name, status: c.status, createdAt: c.created_at, completedAt: c.completed_at }, fields)
    } catch (err) {
      logError('[Relatorios] Erro ao exportar checklist PDF', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      exportState.setExportingChecklistId(null)
    }
  }, [exportState, supabase])

  const handleViewLogs = useCallback(async (c: UserChecklist) => {
    setLogsModal({ open: true, label: `${c.template_name} — ${c.user_name}`, logs: [] })
    setLogsLoading(true)
    try {
      const { data } = await supabase.from('activity_log').select('id, action, created_at, user_id, details').eq('checklist_id', c.id).order('created_at', { ascending: false })
      setLogsModal(prev => ({ ...prev, logs: data || [] }))
    } catch (err) {
      logError('[Relatorios] Erro ao buscar logs', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLogsLoading(false)
    }
  }, [supabase])

  const handleExportSelectedPDF = useCallback(async () => {
    const filtered = userChecklists.filter(c => (!filters.responseFilterUser || c.created_by === filters.responseFilterUser) && (!filters.responseFilterStore || c.store_name === filters.responseFilterStore) && (!filters.responseFilterTemplate || c.template_name === filters.responseFilterTemplate))
    const toExport = filtered.filter(c => filters.selectedIds.has(c.id))
    for (const c of toExport) {
      await handleExportChecklistPDF(c)
      await new Promise(r => setTimeout(r, 600))
    }
    filters.setSelectedIds(new Set())
  }, [userChecklists, filters, handleExportChecklistPDF])

  // ── Shared export dropdown node (passed as prop to each tab) ─────────────────

  const exportDropdownNode = (
    <ExportDropdown
      exporting={exportState.exporting}
      exportingPdf={exportState.exportingPdf}
      isOpen={exportState.exportMenuOpen}
      onToggle={() => exportState.setExportMenuOpen(v => !v)}
      onExport={handleExport}
      onExportPdf={handleExportPdf}
    />
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  if (coreLoading) return <LoadingPage />

  return (
    <>
      <PageContainer>
        {isOffline && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiWifiOff className="w-5 h-5 text-warning" />
            <p className="text-warning text-sm">Voce esta offline. Os dados de relatorios nao estao disponiveis no cache local.</p>
          </div>
        )}

        {fetchError && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiAlertTriangle className="w-5 h-5 text-error" />
            <p className="text-error text-sm">{fetchError}</p>
          </div>
        )}

        {dataWarning && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiAlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-warning text-sm">{dataWarning}</p>
          </div>
        )}

        {/* Tab navigation */}
        <div className="flex gap-2 mb-6">
          {([
            { id: 'overview',       icon: <FiBarChart2 className="w-4 h-4" />,   label: 'Visao Geral' },
            { id: 'responses',      icon: <FiUsers className="w-4 h-4" />,        label: 'Respostas por Usuario' },
            { id: 'conformidade',   icon: <FiAlertTriangle className="w-4 h-4" />, label: 'Conformidade' },
            { id: 'reincidencias',  icon: <FiRepeat className="w-4 h-4" />,       label: 'Reincidências' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            >
              <span className="flex items-center gap-2">{tab.icon}{tab.label}</span>
            </button>
          ))}

          <div className="flex-1" />

          <Link href={APP_CONFIG.routes.adminNCPhotoReport} className="px-4 py-2 rounded-xl font-medium transition-colors btn-secondary flex items-center gap-2">
            <FiCamera className="w-4 h-4" /> Fotos NC
          </Link>
          <Link href={APP_CONFIG.routes.adminActionPlanReport} className="px-4 py-2 rounded-xl font-medium transition-colors btn-secondary flex items-center gap-2">
            <FiClipboard className="w-4 h-4" /> Planos de Acao
          </Link>
        </div>

        {/* Active tab */}
        {activeTab === 'responses' && (
          <ResponsesTab
            userChecklists={userChecklists}
            responseFilterUser={filters.responseFilterUser} setResponseFilterUser={filters.setResponseFilterUser}
            responseFilterStore={filters.responseFilterStore} setResponseFilterStore={filters.setResponseFilterStore}
            responseFilterTemplate={filters.responseFilterTemplate} setResponseFilterTemplate={filters.setResponseFilterTemplate}
            allUsers={allUsers} allStoresSimple={allStoresSimple} allTemplatesSimple={allTemplatesSimple}
            responsePage={filters.responsePage} setResponsePage={filters.setResponsePage}
            selectedIds={filters.selectedIds} setSelectedIds={filters.setSelectedIds}
            exportingChecklistId={exportState.exportingChecklistId}
            onExportChecklistPDF={handleExportChecklistPDF}
            onViewLogs={handleViewLogs}
            onExportSelectedPDF={handleExportSelectedPDF}
            exportDropdownNode={exportDropdownNode}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            overallMetrics={overallMetrics}
            sortedTemplateAdherence={sortedTemplateAdherence}
            sortedStoreAdherence={sortedStoreAdherence}
            sortedUserAdherence={sortedUserAdherence}
            coverageGaps={coverageGaps}
            dailyStatusStats={dailyStatusStats}
            avgCompletionTime={avgCompletionTime}
            attentionPoints={attentionPoints}
            summaryText={summaryText}
            rawStores={rawStores}
            sectorStats={sectorStats}
            requiredActions={requiredActions}
            period={filters.period} setPeriod={filters.setPeriod}
            overviewFilterStore={filters.overviewFilterStore} setOverviewFilterStore={filters.setOverviewFilterStore}
            showAdvancedFilters={filters.showAdvancedFilters} setShowAdvancedFilters={filters.setShowAdvancedFilters}
            hiddenUserIds={filters.hiddenUserIds} setHiddenUserIds={filters.setHiddenUserIds}
            hiddenStoreIds={filters.hiddenStoreIds} setHiddenStoreIds={filters.setHiddenStoreIds}
            hiddenTemplateIds={filters.hiddenTemplateIds} setHiddenTemplateIds={filters.setHiddenTemplateIds}
            allUsers={allUsers} allStoresSimple={allStoresSimple} allTemplatesSimple={allTemplatesSimple}
            templateSort={filters.templateSort} setTemplateSort={filters.setTemplateSort}
            storeSort={filters.storeSort} setStoreSort={filters.setStoreSort}
            userSort={filters.userSort} setUserSort={filters.setUserSort}
            showAllGaps={filters.showAllGaps} setShowAllGaps={filters.setShowAllGaps}
            cardExportMenu={exportState.cardExportMenu} setCardExportMenu={exportState.setCardExportMenu}
            handleCardExport={handleCardExport}
            canExportExcel={canExportExcel} canExportPdf={canExportPdf}
            exportDropdownNode={exportDropdownNode}
          />
        )}

        {activeTab === 'conformidade' && (
          <ConformidadeTab
            period={filters.period} setPeriod={filters.setPeriod}
            complianceSummary={complianceSummary}
            complianceByField={complianceByField}
            complianceByStore={complianceByStore}
            heatmapData={heatmapData}
            exportDropdownNode={exportDropdownNode}
            isLoading={analyticsLoading}
          />
        )}

        {activeTab === 'reincidencias' && (
          <ReincidenciasTab
            period={filters.period} setPeriod={filters.setPeriod}
            reincSummary={reincSummary}
            reincRows={reincRows}
            assigneeStats={assigneeStats}
            exportDropdownNode={exportDropdownNode}
            isLoading={analyticsLoading}
          />
        )}
      </PageContainer>

      <LogsModal
        open={logsModal.open}
        label={logsModal.label}
        logs={logsModal.logs}
        loading={logsLoading}
        onClose={() => setLogsModal(prev => ({ ...prev, open: false }))}
      />
    </>
  )
}
