'use client'

/**
 * /admin/relatorios — client-side orchestrator.
 *
 * Responsibilities of this file (thin orchestrator):
 *  1. Fetch all report data via useReportData()
 *  2. Derive adherence metrics with useMemo (reactive to filter changes)
 *  3. Own UI filter state (period, store, advanced filters, sort, pagination)
 *  4. Own export handler functions and their loading flags
 *  5. Route the active tab to the correct tab component
 *
 * All rendering is delegated to components in ./_components/.
 * All data fetching lives in ./_hooks/useReportData.ts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
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

import type { ActiveTab, Period, UserChecklist } from './_types'
import { useReportData } from './_hooks/useReportData'
import { ExportDropdown } from './_components/ExportDropdown'
import { LogsModal } from './_components/LogsModal'
import { OverviewTab } from './_components/OverviewTab'
import { ResponsesTab } from './_components/ResponsesTab'
import { ConformidadeTab } from './_components/ConformidadeTab'
import { ReincidenciasTab } from './_components/ReincidenciasTab'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RelatoriosPageClient() {
  const { hasFeature } = useFeature()
  const canExportPdf = hasFeature('export_pdf')
  const canExportExcel = hasFeature('export_excel')

  // ── Filter / UI state ───────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>('30d')
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [overviewFilterStore, setOverviewFilterStore] = useState('')
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set())
  const [hiddenStoreIds, setHiddenStoreIds] = useState<Set<number>>(new Set())
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<number>>(new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [templateSort, setTemplateSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [storeSort, setStoreSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [userSort, setUserSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [showAllGaps, setShowAllGaps] = useState(false)
  const [cardExportMenu, setCardExportMenu] = useState<string | null>(null)
  const [responsePage, setResponsePage] = useState(1)
  const [responseFilterUser, setResponseFilterUser] = useState('')
  const [responseFilterStore, setResponseFilterStore] = useState('')
  const [responseFilterTemplate, setResponseFilterTemplate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Export state ────────────────────────────────────────────────────────────
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingChecklistId, setExportingChecklistId] = useState<number | null>(null)

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
  } = useReportData(period)

  // ── Adherence memos (recompute only when raw data or filters change) ─────────

  const filteredChecklists = useMemo(() => rawActiveChecklists.filter(c => {
    if (overviewFilterStore && c.store_id !== Number(overviewFilterStore)) return false
    if (hiddenStoreIds.size > 0 && hiddenStoreIds.has(c.store_id)) return false
    if (hiddenUserIds.size > 0 && hiddenUserIds.has(c.created_by)) return false
    if (hiddenTemplateIds.size > 0 && hiddenTemplateIds.has(c.template_id)) return false
    return true
  }), [rawActiveChecklists, overviewFilterStore, hiddenStoreIds, hiddenUserIds, hiddenTemplateIds])

  const overallMetrics = useMemo(() => {
    if (filteredChecklists.length === 0 && rawActiveChecklists.length === 0) return null
    return computeOverallAdherence(filteredChecklists)
  }, [filteredChecklists, rawActiveChecklists.length])

  const templateAdherence = useMemo(() => {
    const vis = overviewFilterStore ? rawVisibility.filter(v => v.store_id === Number(overviewFilterStore)) : rawVisibility
    const templates = hiddenTemplateIds.size > 0 ? rawTemplates.filter(t => !hiddenTemplateIds.has(t.id)) : rawTemplates
    return computeTemplateAdherence(filteredChecklists, templates, vis)
  }, [filteredChecklists, rawTemplates, rawVisibility, overviewFilterStore, hiddenTemplateIds])

  const storeAdherence = useMemo(() => {
    let stores = overviewFilterStore ? rawStores.filter(s => s.id === Number(overviewFilterStore)) : rawStores
    if (hiddenStoreIds.size > 0) stores = stores.filter(s => !hiddenStoreIds.has(s.id))
    return computeStoreAdherence(filteredChecklists, stores, rawTemplates, rawVisibility)
  }, [filteredChecklists, rawStores, rawTemplates, rawVisibility, overviewFilterStore, hiddenStoreIds])

  const userAdherence = useMemo(() => {
    const users = hiddenUserIds.size > 0 ? rawUsers.filter(u => !hiddenUserIds.has(u.id)) : rawUsers
    return computeUserAdherence(filteredChecklists, users)
  }, [filteredChecklists, rawUsers, hiddenUserIds])

  const coverageGaps = useMemo(() => {
    let stores = overviewFilterStore ? rawStores.filter(s => s.id === Number(overviewFilterStore)) : rawStores
    if (hiddenStoreIds.size > 0) stores = stores.filter(s => !hiddenStoreIds.has(s.id))
    let vis = overviewFilterStore ? rawVisibility.filter(v => v.store_id === Number(overviewFilterStore)) : rawVisibility
    if (hiddenStoreIds.size > 0) vis = vis.filter(v => !hiddenStoreIds.has(v.store_id))
    if (hiddenTemplateIds.size > 0) vis = vis.filter(v => !hiddenTemplateIds.has(v.template_id))
    const templates = hiddenTemplateIds.size > 0 ? rawTemplates.filter(t => !hiddenTemplateIds.has(t.id)) : rawTemplates
    return computeCoverageGaps(filteredChecklists, templates, stores, vis)
  }, [filteredChecklists, rawTemplates, rawStores, rawVisibility, overviewFilterStore, hiddenStoreIds, hiddenTemplateIds])

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
    if (!overviewFilterStore && sectorStats.length > 1) {
      const best = sectorStats[0]
      const worst = sectorStats[sectorStats.length - 1]
      if (!(best.completion_rate === 0 && worst.completion_rate === 0) && best.completion_rate !== worst.completion_rate && best.sector_id !== worst.sector_id) {
        text += ` Melhor setor: ${best.sector_name} (${best.completion_rate}%). Pior: ${worst.sector_name} (${worst.completion_rate}%).`
      }
    }
    return text
  }, [overallMetrics, coverageGaps, sectorStats, overviewFilterStore])

  // ── Sorted adherence arrays ─────────────────────────────────────────────────

  const sortedTemplateAdherence = useMemo(() => {
    const arr = [...templateAdherence]
    if (templateSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (templateSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.templateName.localeCompare(b.templateName))
    return arr
  }, [templateAdherence, templateSort])

  const sortedStoreAdherence = useMemo(() => {
    const arr = [...storeAdherence]
    if (storeSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (storeSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.storeName.localeCompare(b.storeName))
    return arr
  }, [storeAdherence, storeSort])

  const sortedUserAdherence = useMemo(() => {
    const arr = [...userAdherence]
    if (userSort === 'best') arr.sort((a, b) => b.metrics.completionRate - a.metrics.completionRate)
    else if (userSort === 'worst') arr.sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
    else arr.sort((a, b) => a.userName.localeCompare(b.userName))
    return arr
  }, [userAdherence, userSort])

  // ── Side effects ────────────────────────────────────────────────────────────

  useEffect(() => { setExportMenuOpen(false) }, [activeTab])

  // ── Export handlers ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async (format: 'csv' | 'txt' | 'xlsx') => {
    setExportMenuOpen(false)
    setExporting(true)
    try {
      const ts = new Date().toISOString().split('T')[0]
      const tabName = activeTab === 'overview' ? 'visao_geral' : activeTab === 'responses' ? 'respostas' : activeTab === 'conformidade' ? 'conformidade' : 'reincidencias'
      const base = `relatorio_${tabName}_${ts}`
      if (activeTab === 'overview') {
        const data = { summary, storeStats, templateStats, dailyStats, period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime }
        if (format === 'csv') exportOverviewToCSV(data, `${base}.csv`)
        else if (format === 'txt') exportOverviewToTXT(data, `${base}.txt`)
        else await exportOverviewToExcel(data, `${base}.xlsx`)
      } else if (activeTab === 'responses') {
        const filtered = userChecklists.filter(c => (!responseFilterUser || c.created_by === responseFilterUser) && (!responseFilterStore || c.store_name === responseFilterStore) && (!responseFilterTemplate || c.template_name === responseFilterTemplate))
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
      setExporting(false)
    }
  }, [activeTab, summary, storeStats, templateStats, dailyStats, period, overallMetrics, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTime, userChecklists, responseFilterUser, responseFilterStore, responseFilterTemplate, complianceSummary, complianceByField, complianceByStore, reincSummary, reincRows, assigneeStats])

  const handleExportPdf = useCallback(async () => {
    if (exportingPdf) return
    setExportMenuOpen(false)
    setExportingPdf(true)
    try {
      if (activeTab === 'overview') await exportOverviewToPDF({ summary, storeStats, templateStats, dailyStats, period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime })
      else if (activeTab === 'responses') { const filtered = userChecklists.filter(c => (!responseFilterUser || c.created_by === responseFilterUser) && (!responseFilterStore || c.store_name === responseFilterStore) && (!responseFilterTemplate || c.template_name === responseFilterTemplate)); await exportResponsesToPDF(filtered) }
      else if (activeTab === 'conformidade') await exportComplianceToPDF({ summary: complianceSummary, byField: complianceByField, byStore: complianceByStore })
      else await exportReincidenciasToPDF({ summary: reincSummary, rows: reincRows, assigneeStats })
    } catch (err) {
      logError('[Relatorios] Erro ao exportar PDF', { error: err instanceof Error ? err.message : String(err) })
    } finally {
      setExportingPdf(false)
    }
  }, [activeTab, exportingPdf, summary, storeStats, templateStats, dailyStats, period, overallMetrics, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTime, userChecklists, responseFilterUser, responseFilterStore, responseFilterTemplate, complianceSummary, complianceByField, complianceByStore, reincSummary, reincRows, assigneeStats])

  const handleCardExport = useCallback(async (cardType: 'template' | 'store' | 'user', format: 'csv' | 'txt' | 'xlsx' | 'pdf') => {
    setCardExportMenu(null)
    const ts = new Date().toISOString().split('T')[0]
    if (cardType === 'template') {
      if (format === 'csv') exportTemplateAdherenceToCSV(sortedTemplateAdherence, period, `adesao_template_${ts}.csv`)
      else if (format === 'txt') exportTemplateAdherenceToTXT(sortedTemplateAdherence, period, `adesao_template_${ts}.txt`)
      else if (format === 'xlsx') await exportTemplateAdherenceToExcel(sortedTemplateAdherence, period, `adesao_template_${ts}.xlsx`)
      else await exportTemplateAdherenceToPDF(sortedTemplateAdherence, period)
    } else if (cardType === 'store') {
      if (format === 'csv') exportStoreAdherenceToCSV(sortedStoreAdherence, period, `adesao_loja_${ts}.csv`)
      else if (format === 'txt') exportStoreAdherenceToTXT(sortedStoreAdherence, period, `adesao_loja_${ts}.txt`)
      else if (format === 'xlsx') await exportStoreAdherenceToExcel(sortedStoreAdherence, period, `adesao_loja_${ts}.xlsx`)
      else await exportStoreAdherenceToPDF(sortedStoreAdherence, period)
    } else {
      if (format === 'csv') exportUserAdherenceToCSV(sortedUserAdherence, period, `adesao_usuario_${ts}.csv`)
      else if (format === 'txt') exportUserAdherenceToTXT(sortedUserAdherence, period, `adesao_usuario_${ts}.txt`)
      else if (format === 'xlsx') await exportUserAdherenceToExcel(sortedUserAdherence, period, `adesao_usuario_${ts}.xlsx`)
      else await exportUserAdherenceToPDF(sortedUserAdherence, period)
    }
  }, [sortedTemplateAdherence, sortedStoreAdherence, sortedUserAdherence, period])

  const handleExportChecklistPDF = useCallback(async (c: UserChecklist) => {
    if (exportingChecklistId !== null) return
    setExportingChecklistId(c.id)
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
      setExportingChecklistId(null)
    }
  }, [exportingChecklistId, supabase])

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
    const filtered = userChecklists.filter(c => (!responseFilterUser || c.created_by === responseFilterUser) && (!responseFilterStore || c.store_name === responseFilterStore) && (!responseFilterTemplate || c.template_name === responseFilterTemplate))
    const toExport = filtered.filter(c => selectedIds.has(c.id))
    for (const c of toExport) {
      await handleExportChecklistPDF(c)
      await new Promise(r => setTimeout(r, 600))
    }
    setSelectedIds(new Set())
  }, [userChecklists, responseFilterUser, responseFilterStore, responseFilterTemplate, selectedIds, handleExportChecklistPDF])

  // ── Shared export dropdown node (passed as prop to each tab) ─────────────────

  const exportDropdownNode = (
    <ExportDropdown
      exporting={exporting}
      exportingPdf={exportingPdf}
      isOpen={exportMenuOpen}
      onToggle={() => setExportMenuOpen(v => !v)}
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
            { id: 'reincidencias',  icon: <FiRepeat className="w-4 h-4" />,       label: 'Reincidencias' },
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
            responseFilterUser={responseFilterUser} setResponseFilterUser={setResponseFilterUser}
            responseFilterStore={responseFilterStore} setResponseFilterStore={setResponseFilterStore}
            responseFilterTemplate={responseFilterTemplate} setResponseFilterTemplate={setResponseFilterTemplate}
            allUsers={allUsers} allStoresSimple={allStoresSimple} allTemplatesSimple={allTemplatesSimple}
            responsePage={responsePage} setResponsePage={setResponsePage}
            selectedIds={selectedIds} setSelectedIds={setSelectedIds}
            exportingChecklistId={exportingChecklistId}
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
            period={period} setPeriod={setPeriod}
            overviewFilterStore={overviewFilterStore} setOverviewFilterStore={setOverviewFilterStore}
            showAdvancedFilters={showAdvancedFilters} setShowAdvancedFilters={setShowAdvancedFilters}
            hiddenUserIds={hiddenUserIds} setHiddenUserIds={setHiddenUserIds}
            hiddenStoreIds={hiddenStoreIds} setHiddenStoreIds={setHiddenStoreIds}
            hiddenTemplateIds={hiddenTemplateIds} setHiddenTemplateIds={setHiddenTemplateIds}
            allUsers={allUsers} allStoresSimple={allStoresSimple} allTemplatesSimple={allTemplatesSimple}
            templateSort={templateSort} setTemplateSort={setTemplateSort}
            storeSort={storeSort} setStoreSort={setStoreSort}
            userSort={userSort} setUserSort={setUserSort}
            showAllGaps={showAllGaps} setShowAllGaps={setShowAllGaps}
            cardExportMenu={cardExportMenu} setCardExportMenu={setCardExportMenu}
            handleCardExport={handleCardExport}
            canExportExcel={canExportExcel} canExportPdf={canExportPdf}
            exportDropdownNode={exportDropdownNode}
          />
        )}

        {activeTab === 'conformidade' && (
          <ConformidadeTab
            period={period} setPeriod={setPeriod}
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
            period={period} setPeriod={setPeriod}
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
