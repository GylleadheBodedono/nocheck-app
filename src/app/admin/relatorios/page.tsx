'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import {
  FiBarChart2,
  FiUsers,
  FiMapPin,
  FiClipboard,
  FiCheckCircle,
  FiWifiOff,
  FiEye,
  FiFilter,
  FiChevronLeft,
  FiChevronRight,
  FiAlertTriangle,
  FiRepeat,
  FiCamera,
  FiDownload,
  FiChevronDown,
  FiFileText,
  FiClock,
  FiX,
} from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Select, PageContainer } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { fetchComplianceData, fetchReincidenciaData, fetchStoreHeatmap, type ComplianceSummary, type FieldComplianceRow, type StoreComplianceRow, type ReincidenciaSummary, type ReincidenciaRow, type AssigneeStats, type HeatmapCell } from '@/lib/analyticsQueries'
import {
  computeOverallAdherence, computeTemplateAdherence, computeStoreAdherence,
  computeUserAdherence, computeCoverageGaps, computeDailyStatusStats,
  computeAvgCompletionTime, generateEnhancedAttentionPoints, formatMinutes,
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

type StoreStats = {
  store_id: number
  store_name: string
  total_checklists: number
  completed_today: number
  completion_rate: number
}

type TemplateStats = {
  template_id: number
  template_name: string
  total_uses: number
  avg_completion_time: number
}

type DailyStats = {
  date: string
  count: number
}

type SectorStats = {
  sector_id: number
  sector_name: string
  store_name: string
  total_checklists: number
  completed: number
  completion_rate: number
}

type RequiredAction = {
  text: string
  responsible: string
  deadline: string
  deadlineColor: string
}

type UserChecklist = {
  id: number
  status: string
  created_at: string
  completed_at: string | null
  created_by: string
  user_name: string
  user_email: string
  store_name: string
  template_name: string
}

/**
 * Página de relatórios admin (`/admin/relatorios`).
 * 4 abas: Visão Geral (KPIs executivos), Respostas por Usuário, Conformidade e Reincidências.
 * Permite filtrar por período (7d, 30d, 90d) e exportar os dados em CSV/Excel/PDF.
 */
export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [storeStats, setStoreStats] = useState<StoreStats[]>([])
  const [templateStats, setTemplateStats] = useState<TemplateStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [summary, setSummary] = useState({
    totalChecklists: 0,
    completedToday: 0,
    avgPerDay: 0,
    activeUsers: 0,
    activeStores: 0,
    activeTemplates: 0,
  })
  const [isOffline, setIsOffline] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'responses' | 'conformidade' | 'reincidencias'>('overview')
  const [userChecklists, setUserChecklists] = useState<UserChecklist[]>([])
  const [responseFilterUser, setResponseFilterUser] = useState('')
  const [responseFilterStore, setResponseFilterStore] = useState('')
  const [responseFilterTemplate, setResponseFilterTemplate] = useState('')
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [allStoresSimple, setAllStoresSimple] = useState<{ id: number; name: string }[]>([])
  const [allTemplatesSimple, setAllTemplatesSimple] = useState<{ id: number; name: string }[]>([])
  // Conformidade tab state
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>({ totalNonConformities: 0, complianceRate: 100, plansCreated: 0, plansResolved: 0, plansOverdue: 0 })
  const [complianceByField, setComplianceByField] = useState<FieldComplianceRow[]>([])
  const [complianceByStore, setComplianceByStore] = useState<StoreComplianceRow[]>([])
  const [heatmapData, setHeatmapData] = useState<{ cells: HeatmapCell[]; stores: string[]; fields: string[] }>({ cells: [], stores: [], fields: [] })
  // Reincidencia tab state
  const [reincSummary, setReincSummary] = useState<ReincidenciaSummary>({ totalReincidencias: 0, avgReincidenciaRate: 0, worstField: null, worstStore: null })
  const [reincRows, setReincRows] = useState<ReincidenciaRow[]>([])
  const [assigneeStats, setAssigneeStats] = useState<AssigneeStats[]>([])
  const [responsePage, setResponsePage] = useState(1)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingChecklistId, setExportingChecklistId] = useState<number | null>(null)
  const [logsModal, setLogsModal] = useState<{ open: boolean; label: string; logs: { id: number; action: string; created_at: string; user_id: string | null; details: Record<string, unknown> | null }[] }>({ open: false, label: '', logs: [] })
  const [logsLoading, setLogsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  // Visao Geral executive panel state
  const [sectorStats, setSectorStats] = useState<SectorStats[]>([])
  const [requiredActions, setRequiredActions] = useState<RequiredAction[]>([])
  // Raw data for adherence recomputation on filter change
  const [rawActiveChecklists, setRawActiveChecklists] = useState<{ id: number; store_id: number; template_id: number; sector_id: number | null; status: string; created_by: string; started_at: string | null; created_at: string; completed_at: string | null }[]>([])
  const [rawTemplates, setRawTemplates] = useState<{ id: number; name: string }[]>([])
  const [rawStores, setRawStores] = useState<{ id: number; name: string }[]>([])
  const [rawUsers, setRawUsers] = useState<{ id: string; full_name: string }[]>([])
  const [rawVisibility, setRawVisibility] = useState<{ template_id: number; store_id: number }[]>([])
  const [rawChartDays, setRawChartDays] = useState(30)
  const [rawOverdueCount, setRawOverdueCount] = useState(0)
  const [showAllGaps, setShowAllGaps] = useState(false)
  // Filtro de loja na visao geral
  const [overviewFilterStore, setOverviewFilterStore] = useState('')
  // Filtros avancados: ocultacao temporaria de entidades do relatorio
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set())
  const [hiddenStoreIds, setHiddenStoreIds] = useState<Set<number>>(new Set())
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<number>>(new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  // Ordenacao das tabelas de adesao
  const [storeSort, setStoreSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [templateSort, setTemplateSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [userSort, setUserSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [cardExportMenu, setCardExportMenu] = useState<string | null>(null)
  const responsePerPage = 20
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { refreshKey } = useRealtimeRefresh(['checklists'])

  useEffect(() => {
    fetchReportData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    if (refreshKey > 0 && navigator.onLine) fetchReportData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const fetchReportData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    let userId: string | null = null
    let isAdminUser = false

    // Tenta verificar acesso online
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        isAdminUser = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
      }
    } catch {
      console.log('[Relatorios] Falha ao verificar online, tentando cache...')
    }

    // Fallback para cache se offline
    if (!userId) {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          userId = cachedAuth.userId
          const cachedUser = await getUserCache(cachedAuth.userId)
          isAdminUser = cachedUser?.is_admin || false
        }
      } catch {
        console.log('[Relatorios] Falha ao buscar cache')
      }
    }

    if (!userId) {
      router.push(APP_CONFIG.routes.login)
      return
    }

    if (!isAdminUser) {
      router.push(APP_CONFIG.routes.dashboard)
      return
    }

    try {
      setIsOffline(false)
      // Calculate date range
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Fetch all data in parallel for better performance
      const [
        usersRes,
        storesRes,
        templatesRes,
        todayCountRes,
        periodCountRes,
        storesData,
        templatesData,
        allChecklists,
        sectorsData,
        actionPlansData,
        allUsersData,
        visibilityData,
      ] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('checklist_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('stores').select('id, name').eq('is_active', true),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('checklist_templates').select('id, name').eq('is_active', true),
        // Get all checklists in period with sector/status for executive panel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('checklists').select('id, store_id, template_id, sector_id, status, created_by, started_at, created_at, completed_at').gte('created_at', startDate.toISOString()),
        // Sectors with store info
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('sectors').select('id, name, store_id, store:stores(name)').eq('is_active', true),
        // Pending/overdue action plans
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('action_plans').select('id, store_id, field_id, status, severity, deadline, assigned_to, created_at, store:stores(name), field:template_fields(name)').in('status', ['aberto', 'em_andamento', 'vencido']).order('deadline', { ascending: true }).limit(5),
        // All users for assignee names
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('users').select('id, full_name, function_ref:functions(name)'),
        // Template visibility (which templates should be filled in which stores)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('template_visibility').select('template_id, store_id'),
      ])

      setSummary({
        totalChecklists: periodCountRes.count || 0,
        completedToday: todayCountRes.count || 0,
        avgPerDay: Math.round((periodCountRes.count || 0) / days * 10) / 10,
        activeUsers: usersRes.count || 0,
        activeStores: storesRes.count || 0,
        activeTemplates: templatesRes.count || 0,
      })

      // Process store stats from the fetched checklists (no additional queries needed)
      const checklists = allChecklists.data || []

      if (storesData.data) {
        const storeStatsData = storesData.data.map((store: { id: number; name: string }) => {
          const storeChecklists = checklists.filter((c: { store_id: number }) => c.store_id === store.id)
          const todayChecklists = storeChecklists.filter((c: { created_at: string }) =>
            new Date(c.created_at) >= today
          )

          return {
            store_id: store.id,
            store_name: store.name,
            total_checklists: storeChecklists.length,
            completed_today: todayChecklists.length,
            completion_rate: storeChecklists.length ? Math.round((storeChecklists.length / days) * 100) / 100 : 0,
          }
        })
        setStoreStats(storeStatsData.sort((a: StoreStats, b: StoreStats) => b.total_checklists - a.total_checklists))
      }

      // Process template stats from the fetched checklists (no additional queries needed)
      if (templatesData.data) {
        const templateStatsData = templatesData.data.map((template: { id: number; name: string }) => {
          const templateChecklists = checklists.filter((c: { template_id: number }) => c.template_id === template.id)

          return {
            template_id: template.id,
            template_name: template.name,
            total_uses: templateChecklists.length,
            avg_completion_time: 0,
          }
        })
        setTemplateStats(templateStatsData.sort((a: TemplateStats, b: TemplateStats) => b.total_uses - a.total_uses))
      }

      // Generate daily stats from fetched checklists (no additional queries needed)
      const dailyData: DailyStats[] = []
      const chartDays = Math.min(days, 30) // Limit chart to 30 days for readability

      for (let i = chartDays - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)

        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)

        const dayCount = checklists.filter((c: { created_at: string }) => {
          const checklistDate = new Date(c.created_at)
          return checklistDate >= date && checklistDate < nextDate
        }).length

        dailyData.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count: dayCount,
        })
      }
      setDailyStats(dailyData)

      // === Executive panel computations ===
      const sectors = sectorsData?.data || []
      const usersLookup = allUsersData?.data || []
      const actionPlans = actionPlansData?.data || []

      // Compute sector stats
      if (sectors.length > 0) {
        const sectorStatsCalc: SectorStats[] = sectors.map((sector: { id: number; name: string; store_id: number; store: { name: string } | null }) => {
          const sectorChecklists = checklists.filter((c: { sector_id: number }) => c.sector_id === sector.id)
          const completedCount = sectorChecklists.filter((c: { status: string }) => c.status === 'concluido' || c.status === 'validado').length
          const rate = sectorChecklists.length > 0 ? Math.round((completedCount / sectorChecklists.length) * 100) : 0

          return {
            sector_id: sector.id,
            sector_name: sector.name,
            store_name: sector.store?.name || '',
            total_checklists: sectorChecklists.length,
            completed: completedCount,
            completion_rate: rate,
          }
        }).sort((a: SectorStats, b: SectorStats) => b.completion_rate - a.completion_rate)
        setSectorStats(sectorStatsCalc)
      } else {
        setSectorStats([])
      }

      // Generate required actions from action plans
      if (actionPlans.length > 0) {
        const now = new Date()
        const actions: RequiredAction[] = actionPlans.map((ap: {
          id: number; status: string; deadline: string | null; assigned_to: string | null;
          store: { name: string } | null; field: { name: string } | null;
        }) => {
          const fieldName = ap.field?.name || 'Campo desconhecido'
          const storeName = ap.store?.name || 'Loja desconhecida'
          const assignee = usersLookup.find((u: { id: string }) => u.id === ap.assigned_to)
          const assigneeName = assignee?.full_name || 'Não atribuído'
          const assigneeFunction = assignee?.function_ref?.name
          const responsible = assigneeFunction ? `${assigneeName} — ${assigneeFunction}` : assigneeName

          let deadlineStr = 'Sem prazo'
          let deadlineColor = 'bg-gray-500'
          if (ap.deadline) {
            const dl = new Date(ap.deadline)
            deadlineStr = dl.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            const diffDays = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            if (diffDays <= 0) deadlineColor = 'bg-error'
            else if (diffDays <= 7) deadlineColor = 'bg-warning'
            else deadlineColor = 'bg-success'
          }

          return { text: `${fieldName} — ${storeName}`, responsible, deadline: deadlineStr, deadlineColor }
        })
        setRequiredActions(actions)
      } else {
        setRequiredActions([])
      }

      // === Store raw data for adherence — recomputed reactively via useMemo when filters change ===
      const visibilityRows = visibilityData?.data || []
      const storesForAdh = (storesData.data || []).map((s: { id: number; name: string }) => ({ id: s.id, name: s.name }))
      const templatesForAdh = (templatesData.data || []).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name }))
      const usersForAdh = (usersLookup || []).map((u: { id: string; full_name: string }) => ({ id: u.id, full_name: u.full_name || 'Desconhecido' }))

      // Filtrar apenas checklists de templates e lojas ativos
      const activeTemplateIds = new Set(templatesForAdh.map((t: { id: number }) => t.id))
      const activeStoreIds = new Set(storesForAdh.map((s: { id: number }) => s.id))
      const activeChecklists = checklists.filter((c: { template_id: number; store_id: number }) =>
        activeTemplateIds.has(c.template_id) && activeStoreIds.has(c.store_id)
      )


      setRawActiveChecklists(activeChecklists)
      setRawTemplates(templatesForAdh)
      setRawStores(storesForAdh)
      setRawUsers(usersForAdh)
      setRawVisibility(visibilityRows)
      setRawChartDays(Math.min(days, 30))
      setRawOverdueCount(actionPlans.filter((ap: { status: string }) => ap.status === 'vencido').length)

      // Fetch user checklists for responses tab
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userChecklistsData } = await (supabase as any)
        .from('checklists')
        .select(`
          id, status, created_at, completed_at, created_by,
          user:users!checklists_created_by_fkey(full_name, email),
          store:stores(name),
          template:checklist_templates(name)
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (userChecklistsData) {
        const mapped = userChecklistsData.map((c: {
          id: number; status: string; created_at: string; completed_at: string | null; created_by: string;
          user: { full_name: string; email: string } | null;
          store: { name: string } | null;
          template: { name: string } | null;
        }) => ({
          id: c.id,
          status: c.status,
          created_at: c.created_at,
          completed_at: c.completed_at,
          created_by: c.created_by,
          user_name: c.user?.full_name || 'Desconhecido',
          user_email: c.user?.email || '',
          store_name: c.store?.name || '',
          template_name: c.template?.name || '',
        }))
        setUserChecklists(mapped)

        // Extract unique users, stores, templates for filters
        const usersMap = new Map<string, { id: string; name: string; email: string }>()
        const storesMap = new Map<string, { id: number; name: string }>()
        const templatesMap = new Map<string, { id: number; name: string }>()

        for (const c of userChecklistsData) {
          if (c.created_by && c.user) {
            usersMap.set(c.created_by, { id: c.created_by, name: c.user.full_name || c.user.email, email: c.user.email })
          }
          if (c.store) {
            storesMap.set(c.store.name, { id: 0, name: c.store.name })
          }
          if (c.template) {
            templatesMap.set(c.template.name, { id: 0, name: c.template.name })
          }
        }
        setAllUsers(Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setAllStoresSimple(Array.from(storesMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setAllTemplatesSimple(Array.from(templatesMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }

      // Fetch conformidade and reincidencia data
      try {
        const [compData, reincData, heatmap] = await Promise.all([
          fetchComplianceData(supabase, days),
          fetchReincidenciaData(supabase, days),
          fetchStoreHeatmap(supabase, days),
        ])
        setComplianceSummary(compData.summary)
        setComplianceByField(compData.byField)
        setComplianceByStore(compData.byStore)
        setHeatmapData(heatmap)
        setReincSummary(reincData.summary)
        setReincRows(reincData.rows)
        setAssigneeStats(reincData.byAssignee)
      } catch (analyticsErr) {
        console.warn('[Relatorios] Erro ao buscar analytics (tabelas podem nao existir ainda):', analyticsErr)
      }

    } catch (error) {
      console.error('[Relatorios] Erro ao buscar dados:', error)
      setIsOffline(true)
    }

    setLoading(false)
  }

  // === Reactive adherence: recomputes ALL data when filters or raw data changes ===
  const filteredChecklists = useMemo(() => {
    return rawActiveChecklists.filter(c => {
      if (overviewFilterStore && c.store_id !== Number(overviewFilterStore)) return false
      if (hiddenStoreIds.size > 0 && hiddenStoreIds.has(c.store_id)) return false
      if (hiddenUserIds.size > 0 && hiddenUserIds.has(c.created_by)) return false
      if (hiddenTemplateIds.size > 0 && hiddenTemplateIds.has(c.template_id)) return false
      return true
    })
  }, [rawActiveChecklists, overviewFilterStore, hiddenStoreIds, hiddenUserIds, hiddenTemplateIds])

  const overallMetrics = useMemo(() => {
    if (filteredChecklists.length === 0 && rawActiveChecklists.length === 0) return null
    return computeOverallAdherence(filteredChecklists)
  }, [filteredChecklists, rawActiveChecklists])

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

  const dailyStatusStats = useMemo(() => {
    return computeDailyStatusStats(filteredChecklists, rawChartDays)
  }, [filteredChecklists, rawChartDays])

  const avgCompletionTime = useMemo(() => {
    return computeAvgCompletionTime(filteredChecklists)
  }, [filteredChecklists])

  const attentionPoints = useMemo(() => {
    if (rawActiveChecklists.length === 0 && filteredChecklists.length === 0) return []
    const unusedTemplateNames = rawTemplates
      .filter(t => !filteredChecklists.some(c => c.template_id === t.id))
      .filter(t => !rawVisibility.some(v => v.template_id === t.id))
      .map(t => t.name)
    return generateEnhancedAttentionPoints(storeAdherence, templateAdherence, coverageGaps, rawOverdueCount, unusedTemplateNames)
  }, [filteredChecklists, rawActiveChecklists, rawTemplates, rawVisibility, storeAdherence, templateAdherence, coverageGaps, rawOverdueCount])

  // Sorted arrays for display
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

  // Executive summary text
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
    if (coverageGaps.length > 0) {
      text += ` ${coverageGaps.length} checklist${coverageGaps.length > 1 ? 's' : ''} nao preenchido${coverageGaps.length > 1 ? 's' : ''} (deveriam ter sido feitos mas nao foram).`
    }

    if (!overviewFilterStore && sectorStats.length > 1) {
      const best = sectorStats[0]
      const worst = sectorStats[sectorStats.length - 1]
      const allZero = best.completion_rate === 0 && worst.completion_rate === 0
      const allSame = best.completion_rate === worst.completion_rate

      if (allZero) {
        text += ' Nenhum setor concluiu checklists no periodo.'
      } else if (!allSame && best.sector_id !== worst.sector_id) {
        text += ` Melhor setor: ${best.sector_name} (${best.completion_rate}%). Pior: ${worst.sector_name} (${worst.completion_rate}%).`
      }
    }
    return text
  }, [overallMetrics, coverageGaps, sectorStats, overviewFilterStore])

  // Filter user checklists
  const filteredUserChecklists = useMemo(() => {
    return userChecklists.filter(c => {
      if (responseFilterUser && c.created_by !== responseFilterUser) return false
      if (responseFilterStore && c.store_name !== responseFilterStore) return false
      if (responseFilterTemplate && c.template_name !== responseFilterTemplate) return false
      return true
    })
  }, [userChecklists, responseFilterUser, responseFilterStore, responseFilterTemplate])

  const responseTotalPages = Math.ceil(filteredUserChecklists.length / responsePerPage)
  const paginatedUserChecklists = filteredUserChecklists.slice((responsePage - 1) * responsePerPage, responsePage * responsePerPage)

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; cls: string }> = {
      validado: { label: 'Validado', cls: 'bg-success/20 text-success' },
      concluido: { label: 'Concluído', cls: 'bg-primary/20 text-primary' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-warning/20 text-warning' },
      incompleto: { label: 'Incompleto', cls: 'bg-error/20 text-error' },
      rascunho: { label: 'Rascunho', cls: 'bg-surface-hover text-muted' },
    }
    return badges[status] || { label: status, cls: 'bg-surface-hover text-muted' }
  }

  // Close export menu on tab switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setExportMenuOpen(false) }, [activeTab])

  const handleExport = async (format: 'csv' | 'txt' | 'xlsx') => {
    setExportMenuOpen(false)
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const tabName = activeTab === 'overview' ? 'visao_geral' : activeTab === 'responses' ? 'respostas' : activeTab === 'conformidade' ? 'conformidade' : 'reincidencias'
      const filename = `relatorio_${tabName}_${timestamp}`

      if (activeTab === 'overview') {
        const data = { summary, storeStats, templateStats, dailyStats, period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime }
        if (format === 'csv') exportOverviewToCSV(data, `${filename}.csv`)
        else if (format === 'txt') exportOverviewToTXT(data, `${filename}.txt`)
        else await exportOverviewToExcel(data, `${filename}.xlsx`)
      } else if (activeTab === 'responses') {
        if (format === 'csv') exportResponsesToCSV(filteredUserChecklists, `${filename}.csv`)
        else if (format === 'txt') exportResponsesToTXT(filteredUserChecklists, `${filename}.txt`)
        else await exportResponsesToExcel(filteredUserChecklists, `${filename}.xlsx`)
      } else if (activeTab === 'conformidade') {
        const data = { summary: complianceSummary, byField: complianceByField, byStore: complianceByStore }
        if (format === 'csv') exportComplianceToCSV(data, `${filename}.csv`)
        else if (format === 'txt') exportComplianceToTXT(data, `${filename}.txt`)
        else await exportComplianceToExcel(data, `${filename}.xlsx`)
      } else {
        const data = { summary: reincSummary, rows: reincRows, assigneeStats }
        if (format === 'csv') exportReincidenciasToCSV(data, `${filename}.csv`)
        else if (format === 'txt') exportReincidenciasToTXT(data, `${filename}.txt`)
        else await exportReincidenciasToExcel(data, `${filename}.xlsx`)
      }
    } catch (err) {
      console.error('[Relatorios] Erro ao exportar:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = async () => {
    if (exportingPdf) return
    setExportMenuOpen(false)
    setExportingPdf(true)
    try {
      if (activeTab === 'overview') {
        await exportOverviewToPDF({ summary, storeStats, templateStats, dailyStats, period, overallMetrics: overallMetrics ?? undefined, templateAdherence, storeAdherence, userAdherence, coverageGaps, avgCompletionTimeMinutes: avgCompletionTime })
      } else if (activeTab === 'responses') {
        await exportResponsesToPDF(filteredUserChecklists)
      } else if (activeTab === 'conformidade') {
        await exportComplianceToPDF({ summary: complianceSummary, byField: complianceByField, byStore: complianceByStore })
      } else {
        await exportReincidenciasToPDF({ summary: reincSummary, rows: reincRows, assigneeStats })
      }
    } catch (err) {
      console.error('[Relatorios] Erro ao exportar PDF:', err)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleCardExport = async (cardType: 'template' | 'store' | 'user', format: 'csv' | 'txt' | 'xlsx' | 'pdf') => {
    setCardExportMenu(null)
    const timestamp = new Date().toISOString().split('T')[0]
    if (cardType === 'template') {
      if (format === 'csv') exportTemplateAdherenceToCSV(sortedTemplateAdherence, period, `adesao_template_${timestamp}.csv`)
      else if (format === 'txt') exportTemplateAdherenceToTXT(sortedTemplateAdherence, period, `adesao_template_${timestamp}.txt`)
      else if (format === 'xlsx') await exportTemplateAdherenceToExcel(sortedTemplateAdherence, period, `adesao_template_${timestamp}.xlsx`)
      else await exportTemplateAdherenceToPDF(sortedTemplateAdherence, period)
    } else if (cardType === 'store') {
      if (format === 'csv') exportStoreAdherenceToCSV(sortedStoreAdherence, period, `adesao_loja_${timestamp}.csv`)
      else if (format === 'txt') exportStoreAdherenceToTXT(sortedStoreAdherence, period, `adesao_loja_${timestamp}.txt`)
      else if (format === 'xlsx') await exportStoreAdherenceToExcel(sortedStoreAdherence, period, `adesao_loja_${timestamp}.xlsx`)
      else await exportStoreAdherenceToPDF(sortedStoreAdherence, period)
    } else {
      if (format === 'csv') exportUserAdherenceToCSV(sortedUserAdherence, period, `adesao_usuario_${timestamp}.csv`)
      else if (format === 'txt') exportUserAdherenceToTXT(sortedUserAdherence, period, `adesao_usuario_${timestamp}.txt`)
      else if (format === 'xlsx') await exportUserAdherenceToExcel(sortedUserAdherence, period, `adesao_usuario_${timestamp}.xlsx`)
      else await exportUserAdherenceToPDF(sortedUserAdherence, period)
    }
  }

  const CardExportDropdown = ({ cardType }: { cardType: 'template' | 'store' | 'user' }) => {
    const isOpen = cardExportMenu === cardType
    return (
      <div className="relative">
        <button
          onClick={() => setCardExportMenu(isOpen ? null : cardType)}
          className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors"
          title="Exportar esta tabela"
        >
          <FiDownload className="w-4 h-4" />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[120px]">
            <button onClick={() => handleCardExport(cardType, 'csv')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-t-lg">CSV</button>
            <button onClick={() => handleCardExport(cardType, 'xlsx')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">Excel</button>
            <button onClick={() => handleCardExport(cardType, 'txt')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">TXT</button>
            <button onClick={() => handleCardExport(cardType, 'pdf')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-b-lg">PDF</button>
          </div>
        )}
      </div>
    )
  }

  const handleExportChecklistPDF = async (c: UserChecklist) => {
    if (exportingChecklistId !== null) return
    setExportingChecklistId(c.id)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: responses } = await (supabase as any)
        .from('checklist_responses')
        .select('field_id, value_text, value_number, value_json, template_fields(name, field_type)')
        .eq('checklist_id', c.id)

      const fields: ChecklistFieldResponse[] = (responses || []).map((r: {
        field_id: number; value_text: string | null; value_number: number | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        value_json: any; template_fields: any
      }) => {
        const vj = r.value_json as Record<string, unknown> | null
        let answer = '-'
        const photos: string[] = []
        if (r.value_text !== null && r.value_text !== '') {
          answer = r.value_text
        } else if (r.value_number !== null) {
          answer = String(r.value_number)
        } else if (vj !== null) {
          const ans = vj.answer !== undefined ? String(vj.answer) : ''
          const condText = vj.conditionalText ? String(vj.conditionalText) : ''
          answer = ans + (condText ? (ans ? ` — ${condText}` : condText) : '') || '-'
          photos.push(...((vj.photos as string[]) || []))
          photos.push(...((vj.conditionalPhotos as string[]) || []))
        }
        return { fieldName: r.template_fields?.name || `Campo ${r.field_id}`, fieldType: r.template_fields?.field_type || '', answer, photos }
      })

      await exportChecklistDetailToPDF({
        userName: c.user_name, userEmail: c.user_email, storeName: c.store_name,
        templateName: c.template_name, status: c.status,
        createdAt: c.created_at, completedAt: c.completed_at,
      }, fields)
    } catch (err) {
      console.error('[Relatorios] Erro ao exportar checklist PDF:', err)
    } finally {
      setExportingChecklistId(null)
    }
  }

  const handleViewLogs = async (c: UserChecklist) => {
    setLogsModal({ open: true, label: `${c.template_name} — ${c.user_name}`, logs: [] })
    setLogsLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('activity_log')
        .select('id, action, created_at, user_id, details')
        .eq('checklist_id', c.id)
        .order('created_at', { ascending: false })
      setLogsModal(prev => ({ ...prev, logs: data || [] }))
    } catch (err) {
      console.error('[Relatorios] Erro ao buscar logs:', err)
    } finally {
      setLogsLoading(false)
    }
  }

  const handleExportSelectedPDF = async () => {
    const toExport = filteredUserChecklists.filter(c => selectedIds.has(c.id))
    for (const c of toExport) {
      await handleExportChecklistPDF(c)
      await new Promise(r => setTimeout(r, 600))
    }
    setSelectedIds(new Set())
  }

  const exportDropdown = (
    <div className="relative">
      <button
        onClick={() => setExportMenuOpen(!exportMenuOpen)}
        disabled={exporting || exportingPdf}
        className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
      >
        <FiDownload className="text-base" />
        {exportingPdf ? 'Gerando PDF...' : exporting ? 'Exportando...' : 'Exportar'}
        <FiChevronDown className="text-xs" />
      </button>
      {exportMenuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[160px]">
          <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-t-lg">CSV</button>
          <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">Excel</button>
          <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">TXT</button>
          <button onClick={handleExportPdf} disabled={exportingPdf} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-b-lg disabled:opacity-50">
            {exportingPdf ? 'Gerando PDF...' : 'PDF'}
          </button>
        </div>
      )}
    </div>
  )

  if (loading) {
    return <LoadingPage />
  }

  return (
    <>
      <PageContainer>
        {/* Offline Warning */}
        {isOffline && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiWifiOff className="w-5 h-5 text-warning" />
            <p className="text-warning text-sm">
              Voce esta offline. Os dados de relatorios nao estao disponiveis no cache local.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiBarChart2 className="w-4 h-4" />
              Visao Geral
            </span>
          </button>
          <button
            onClick={() => setActiveTab('responses')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'responses' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiUsers className="w-4 h-4" />
              Respostas por Usuario
            </span>
          </button>
          <button
            onClick={() => setActiveTab('conformidade')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'conformidade' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiAlertTriangle className="w-4 h-4" />
              Conformidade
            </span>
          </button>
          <button
            onClick={() => setActiveTab('reincidencias')}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${
              activeTab === 'reincidencias' ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <span className="flex items-center gap-2">
              <FiRepeat className="w-4 h-4" />
              Reincidências
            </span>
          </button>

          <div className="flex-1" />

          <Link
            href={APP_CONFIG.routes.adminNCPhotoReport}
            className="px-4 py-2 rounded-xl font-medium transition-colors btn-secondary flex items-center gap-2"
          >
            <FiCamera className="w-4 h-4" />
            Fotos NC
          </Link>

          <Link
            href={APP_CONFIG.routes.adminActionPlanReport}
            className="px-4 py-2 rounded-xl font-medium transition-colors btn-secondary flex items-center gap-2"
          >
            <FiClipboard className="w-4 h-4" />
            Planos de Acao
          </Link>
        </div>

        {activeTab === 'responses' && (
          <div>
            {/* Filters */}
            <div className="card p-4 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <FiFilter className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-main">Filtros</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  value={responseFilterUser}
                  onChange={(v) => { setResponseFilterUser(v); setResponsePage(1) }}
                  placeholder="Todos os usuarios"
                  options={allUsers.map(u => ({ value: u.id, label: u.name }))}
                />
                <Select
                  value={responseFilterStore}
                  onChange={(v) => { setResponseFilterStore(v); setResponsePage(1) }}
                  placeholder="Todas as lojas"
                  options={allStoresSimple.map(s => ({ value: s.name, label: s.name }))}
                />
                <Select
                  value={responseFilterTemplate}
                  onChange={(v) => { setResponseFilterTemplate(v); setResponsePage(1) }}
                  placeholder="Todos os checklists"
                  options={allTemplatesSimple.map(t => ({ value: t.name, label: t.name }))}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted">
                {filteredUserChecklists.length} checklist(s)
                {responseFilterUser && ` de ${allUsers.find(u => u.id === responseFilterUser)?.name || 'usuario'}`}
              </p>
              {exportDropdown}
            </div>

            {/* Bulk export banner */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl mb-3">
                <span className="text-sm text-primary font-medium">
                  {selectedIds.size} resposta{selectedIds.size > 1 ? 's' : ''} selecionada{selectedIds.size > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted hover:text-main px-3 py-1.5 rounded-lg">
                    Limpar
                  </button>
                  <button
                    onClick={handleExportSelectedPDF}
                    className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90"
                  >
                    <FiFileText className="w-3.5 h-3.5" /> Exportar PDF{selectedIds.size > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-hover">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={filteredUserChecklists.length > 0 && filteredUserChecklists.every(c => selectedIds.has(c.id))}
                          onChange={e => setSelectedIds(e.target.checked ? new Set(filteredUserChecklists.map(c => c.id)) : new Set())}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Usuario</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Checklist</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Data</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {paginatedUserChecklists.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-muted">
                          Nenhum checklist encontrado
                        </td>
                      </tr>
                    ) : (
                      paginatedUserChecklists.map(c => {
                        const badge = getStatusBadge(c.status)
                        return (
                          <tr key={c.id} className="hover:bg-surface-hover/50">
                            <td className="px-4 py-3 w-10">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={e => setSelectedIds(prev => {
                                  const n = new Set(prev)
                                  if (e.target.checked) { n.add(c.id) } else { n.delete(c.id) }
                                  return n
                                })}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-main text-sm">{c.user_name}</p>
                                <p className="text-xs text-muted">{c.user_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-main">{c.template_name}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-secondary">{c.store_name}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${badge.cls}`}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-muted">{formatDateShort(c.created_at)}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/checklist/${c.id}`}
                                  className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                                  title="Ver respostas"
                                >
                                  <FiEye className="w-4 h-4" />
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleExportChecklistPDF(c)}
                                  disabled={exportingChecklistId === c.id}
                                  className="p-2 text-secondary hover:bg-primary/10 rounded-lg transition-colors inline-flex disabled:opacity-40"
                                  title="Exportar PDF com fotos"
                                >
                                  <FiFileText className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleViewLogs(c)}
                                  className="p-2 text-secondary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                                  title="Ver logs"
                                >
                                  <FiClock className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {responseTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
                  <p className="text-sm text-muted">
                    Pagina {responsePage} de {responseTotalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResponsePage(p => Math.max(1, p - 1))}
                      disabled={responsePage === 1}
                      className="btn-ghost p-2 disabled:opacity-50"
                    >
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setResponsePage(p => Math.min(responseTotalPages, p + 1))}
                      disabled={responsePage === responseTotalPages}
                      className="btn-ghost p-2 disabled:opacity-50"
                    >
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && <>
        {/* Period + Store Filters */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-main">Visao Geral</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={overviewFilterStore}
              onChange={(e) => setOverviewFilterStore(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm bg-surface border border-subtle text-main focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Todas as lojas</option>
              {rawStores.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  period === p ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
              </button>
            ))}
            {/* Botao de Filtros Avancados com badge de ocultacoes ativas */}
            <button
              onClick={() => setShowAdvancedFilters(v => !v)}
              className={`relative px-4 py-2 rounded-xl font-medium transition-colors text-sm ${showAdvancedFilters ? 'btn-primary' : 'btn-secondary'}`}
            >
              Filtros Avancados
              {(hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-warning text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size}
                </span>
              )}
            </button>
            {exportDropdown}
          </div>
        </div>

        {/* Painel de Filtros Avancados — ocultacao temporaria de entidades */}
        {showAdvancedFilters && (
          <div className="mb-6 p-4 bg-surface border border-subtle rounded-xl flex flex-col gap-4">
            {/* Ocultar Usuarios */}
            <div>
              <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Usuarios do relatorio</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    setHiddenUserIds(prev => new Set([...prev, e.target.value]))
                  }}
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

            {/* Ocultar Lojas */}
            <div>
              <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Lojas do relatorio</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    setHiddenStoreIds(prev => new Set([...prev, Number(e.target.value)]))
                  }}
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

            {/* Ocultar Templates */}
            <div>
              <p className="text-xs font-semibold text-muted mb-2 uppercase tracking-wide">Ocultar Templates do relatorio</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    setHiddenTemplateIds(prev => new Set([...prev, Number(e.target.value)]))
                  }}
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

            {/* Limpar ocultacoes */}
            {(hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size) > 0 && (
              <div className="pt-2 border-t border-subtle">
                <button
                  onClick={() => { setHiddenUserIds(new Set()); setHiddenStoreIds(new Set()); setHiddenTemplateIds(new Set()) }}
                  className="text-xs text-muted hover:text-error transition-colors underline underline-offset-2"
                >
                  Limpar ocultacoes ({hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size} {hiddenUserIds.size + hiddenStoreIds.size + hiddenTemplateIds.size === 1 ? 'item oculto' : 'itens ocultos'})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Executive Summary Card */}
        {summaryText && (
          <div className="border-l-4 border-primary bg-surface rounded-r-xl px-5 py-4 mb-6">
            <p className="text-sm text-main leading-relaxed">{summaryText}</p>
          </div>
        )}

        {/* KPI Cards — 6 cards */}
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

        {/* Status Distribution Bar */}
        {overallMetrics && overallMetrics.statusBreakdown.total > 0 && (() => {
          const sb = overallMetrics.statusBreakdown
          const t = sb.total
          const segments = [
            { key: 'validado', label: 'Validado', count: sb.validado, color: 'bg-success', textColor: 'text-success' },
            { key: 'concluido', label: 'Concluído', count: sb.concluido, color: 'bg-primary', textColor: 'text-primary' },
            { key: 'em_andamento', label: 'Em Andamento', count: sb.em_andamento, color: 'bg-warning', textColor: 'text-warning' },
            { key: 'incompleto', label: 'Incompleto', count: sb.incompleto, color: 'bg-error', textColor: 'text-error' },
            { key: 'rascunho', label: 'Rascunho', count: sb.rascunho, color: 'bg-surface-hover', textColor: 'text-muted' },
          ].filter(s => s.count > 0)
          return (
            <div className="card p-5 mb-6">
              <h3 className="text-sm font-semibold text-main mb-3">Distribuicao de Status</h3>
              <div className="h-6 rounded-full overflow-hidden flex">
                {segments.map(s => (
                  <div
                    key={s.key}
                    className={`${s.color} transition-all relative group`}
                    style={{ width: `${(s.count / t) * 100}%` }}
                    title={`${s.label}: ${s.count} (${Math.round((s.count / t) * 100)}%)`}
                  />
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

        {/* Attention Points + Required Actions */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Pontos de Atencao */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-warning uppercase tracking-wide mb-4">
              <FiAlertTriangle className="w-5 h-5" />
              Pontos de Atencao
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {attentionPoints.length === 0 ? (
                <div className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3">
                  <p className="text-sm text-muted">Nenhum ponto de atencao no periodo</p>
                </div>
              ) : (
                attentionPoints.map((p, i) => (
                  <div key={i} className={`border-l-4 ${p.severity === 'error' ? 'border-error' : 'border-warning'} bg-surface rounded-r-xl px-4 py-3`}>
                    <p className="text-sm text-main">{p.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Acoes Necessarias */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-success uppercase tracking-wide mb-4">
              <FiCheckCircle className="w-5 h-5" />
              Acoes Necessarias
            </h3>
            <div className="space-y-3">
              {requiredActions.length === 0 ? (
                <div className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3">
                  <p className="text-sm text-muted">Nenhuma acao pendente</p>
                </div>
              ) : (
                requiredActions.map((a, i) => (
                  <div key={i} className="border-l-4 border-success bg-surface rounded-r-xl px-4 py-3 flex items-center justify-between gap-2">
                    <p className="text-sm text-main flex-1">{a.text}</p>
                    <span className="text-xs text-muted whitespace-nowrap">{a.responsible}</span>
                    <span className={`text-xs text-white px-2 py-1 rounded whitespace-nowrap ${a.deadlineColor}`}>{a.deadline}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Stacked Daily Chart */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-main mb-2">Checklists por Dia</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {[
              { label: 'Validado', color: 'bg-success' },
              { label: 'Concluído', color: 'bg-primary' },
              { label: 'Em Andamento', color: 'bg-warning' },
              { label: 'Incompleto', color: 'bg-error' },
              { label: 'Rascunho', color: 'bg-surface-hover' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1 text-[10px] text-muted">
                <span className={`w-2 h-2 rounded-full ${l.color}`} />
                {l.label}
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
                    {index % 5 === 0 && (
                      <span className="text-[10px] text-muted">{day.date}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* Adesao por Template */}
        <div className="card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
            <h3 className="font-semibold text-main flex items-center gap-2">
              <FiClipboard className="w-4 h-4" />
              Adesao por Template
            </h3>
            <div className="flex gap-1 ml-auto">
              <button onClick={() => setTemplateSort('worst')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${templateSort === 'worst' ? 'bg-error/20 text-error' : 'bg-surface-hover text-muted hover:text-main'}`}>Pior primeiro</button>
              <button onClick={() => setTemplateSort('best')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${templateSort === 'best' ? 'bg-success/20 text-success' : 'bg-surface-hover text-muted hover:text-main'}`}>Melhor primeiro</button>
              <button onClick={() => setTemplateSort('name')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${templateSort === 'name' ? 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>A-Z</button>
            </div>
            <CardExportDropdown cardType="template" />
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
                ) : sortedTemplateAdherence.map((t) => {
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
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                          t.metrics.completionRate >= 80 ? 'bg-success/20 text-success' :
                          t.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' :
                          'bg-error/20 text-error'
                        }`}>{t.metrics.completionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.storesWithZero > 0 ? (
                          <span className="text-xs text-error font-medium">{t.storesWithZero} loja{t.storesWithZero > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
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

        {/* Adesao por Loja */}
        <div className="card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
            <h3 className="font-semibold text-main flex items-center gap-2">
              <FiMapPin className="w-4 h-4" />
              Adesao por Loja
            </h3>
            <div className="flex gap-1 ml-auto">
              <button onClick={() => setStoreSort('worst')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${storeSort === 'worst' ? 'bg-error/20 text-error' : 'bg-surface-hover text-muted hover:text-main'}`}>Pior primeiro</button>
              <button onClick={() => setStoreSort('best')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${storeSort === 'best' ? 'bg-success/20 text-success' : 'bg-surface-hover text-muted hover:text-main'}`}>Melhor primeiro</button>
              <button onClick={() => setStoreSort('name')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${storeSort === 'name' ? 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>A-Z</button>
            </div>
            <CardExportDropdown cardType="store" />
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
                ) : sortedStoreAdherence.map((s) => {
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
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                          s.metrics.completionRate >= 80 ? 'bg-success/20 text-success' :
                          s.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' :
                          'bg-error/20 text-error'
                        }`}>{s.metrics.completionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.templatesNeverFilled.length > 0 ? (
                          <span
                            className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-error/20 text-error cursor-help"
                            title={s.templatesNeverFilled.join('\n')}
                          >
                            {s.templatesNeverFilled.length}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Adesao por Usuario */}
        <div className="card overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-subtle flex items-center flex-wrap gap-2">
            <h3 className="font-semibold text-main flex items-center gap-2">
              <FiUsers className="w-4 h-4" />
              Adesao por Usuario
            </h3>
            <div className="flex gap-1 ml-auto">
              <button onClick={() => setUserSort('worst')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${userSort === 'worst' ? 'bg-error/20 text-error' : 'bg-surface-hover text-muted hover:text-main'}`}>Pior primeiro</button>
              <button onClick={() => setUserSort('best')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${userSort === 'best' ? 'bg-success/20 text-success' : 'bg-surface-hover text-muted hover:text-main'}`}>Melhor primeiro</button>
              <button onClick={() => setUserSort('name')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${userSort === 'name' ? 'bg-primary/20 text-primary' : 'bg-surface-hover text-muted hover:text-main'}`}>A-Z</button>
            </div>
            <CardExportDropdown cardType="user" />
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
                ) : sortedUserAdherence.map((u) => {
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
                        <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold ${
                          u.metrics.completionRate >= 80 ? 'bg-success/20 text-success' :
                          u.metrics.completionRate >= 50 ? 'bg-warning/20 text-warning' :
                          'bg-error/20 text-error'
                        }`}>{u.metrics.completionRate}%</span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{formatMinutes(u.avgCompletionTimeMinutes)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coverage Gaps */}
        {coverageGaps.length > 0 && (
          <div className="card overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-subtle">
              <h3 className="font-semibold text-main flex items-center gap-2">
                <FiAlertTriangle className="w-4 h-4 text-error" />
                Checklists Nao Preenchidos
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
                        <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-error/20 text-error">
                          Nunca preenchido
                        </span>
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
        </>}

        {activeTab === 'conformidade' && (
          <div>
            {/* Period filter */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-main">Conformidade</h2>
              <div className="flex items-center gap-2">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
                    {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                  </button>
                ))}
                {exportDropdown}
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
                    ) : complianceByField.map((row) => (
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
              {/* By store */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-subtle">
                  <h3 className="font-semibold text-main">Ranking por Loja</h3>
                </div>
                <div className="divide-y divide-subtle">
                  {complianceByStore.length === 0 ? (
                    <div className="px-6 py-8 text-center text-muted">Nenhum dado</div>
                  ) : complianceByStore.map((store) => (
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

              {/* Heatmap */}
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
                        {heatmapData.stores.map(store => {
                          const maxCount = Math.max(...heatmapData.cells.map(c => c.count), 1)
                          return (
                            <tr key={store}>
                              <td className="px-2 py-1 font-medium text-main whitespace-nowrap">{store}</td>
                              {heatmapData.fields.map(field => {
                                const cell = heatmapData.cells.find(c => c.storeName === store && c.fieldName === field)
                                const count = cell?.count || 0
                                const intensity = count / maxCount
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
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reincidencias' && (
          <div>
            {/* Period filter */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-main">Reincidências</h2>
              <div className="flex items-center gap-2">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-2 rounded-xl font-medium transition-colors ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
                    {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                  </button>
                ))}
                {exportDropdown}
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
                        <td className="px-4 py-3 text-right text-sm text-muted">{new Date(row.lastOccurrence).toLocaleDateString('pt-BR')}</td>
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
                    ) : assigneeStats.map((a) => (
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
        )}
      </PageContainer>

      {/* Logs Modal */}

      {logsModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-subtle">
              <div>
                <h2 className="font-semibold text-main flex items-center gap-2">
                  <FiClock className="w-4 h-4 text-primary" /> Logs de Atividade
                </h2>
                <p className="text-xs text-muted mt-0.5">{logsModal.label}</p>
              </div>
              <button type="button" onClick={() => setLogsModal(prev => ({ ...prev, open: false }))} className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-lg transition-colors">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {logsLoading ? (
                <p className="text-center text-muted text-sm py-8">Carregando...</p>
              ) : logsModal.logs.length === 0 ? (
                <p className="text-center text-muted text-sm py-8">Nenhum log encontrado para este checklist.</p>
              ) : (
                <div className="space-y-3">
                  {logsModal.logs.map(log => (
                    <div key={log.id} className="card p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted shrink-0">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-secondary space-y-0.5 pt-1">
                          {Object.entries(log.details).map(([k, v]) => (
                            <p key={k}><span className="text-muted">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
