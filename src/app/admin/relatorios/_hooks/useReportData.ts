'use client'

/**
 * useReportData — encapsulates all data fetching for /admin/relatorios.
 *
 * Triggers on:
 *  - period change
 *  - Supabase Realtime refresh (checklists table)
 *
 * Returns all raw state needed by the page's adherence memos and tab components.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { APP_CONFIG } from '@/lib/config'
import { logError, logWarn, logInfo } from '@/lib/clientLogger'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import {
  fetchComplianceData,
  fetchReincidenciaData,
  fetchStoreHeatmap,
  type ComplianceSummary,
  type FieldComplianceRow,
  type StoreComplianceRow,
  type ReincidenciaSummary,
  type ReincidenciaRow,
  type AssigneeStats,
  type HeatmapCell,
} from '@/lib/analyticsQueries'
import type {
  Period,
  StoreStats,
  TemplateStats,
  DailyStats,
  SectorStats,
  RequiredAction,
  UserChecklist,
  RawChecklist,
} from '../_types'

// ── Return type ───────────────────────────────────────────────────────────────

export type ReportData = {
  coreLoading: boolean
  analyticsLoading: boolean
  isOffline: boolean
  fetchError: string | null
  dataWarning: string | null
  summary: {
    totalChecklists: number
    completedToday: number
    avgPerDay: number
    activeUsers: number
    activeStores: number
    activeTemplates: number
  }
  storeStats: StoreStats[]
  templateStats: TemplateStats[]
  dailyStats: DailyStats[]
  sectorStats: SectorStats[]
  requiredActions: RequiredAction[]
  rawActiveChecklists: RawChecklist[]
  rawTemplates: { id: number; name: string }[]
  rawStores: { id: number; name: string }[]
  rawUsers: { id: string; full_name: string }[]
  rawVisibility: { template_id: number; store_id: number }[]
  rawChartDays: number
  rawOverdueCount: number
  userChecklists: UserChecklist[]
  allUsers: { id: string; name: string; email: string }[]
  allStoresSimple: { id: number; name: string }[]
  allTemplatesSimple: { id: number; name: string }[]
  complianceSummary: ComplianceSummary
  complianceByField: FieldComplianceRow[]
  complianceByStore: StoreComplianceRow[]
  heatmapData: { cells: HeatmapCell[]; stores: string[]; fields: string[] }
  reincSummary: ReincidenciaSummary
  reincRows: ReincidenciaRow[]
  assigneeStats: AssigneeStats[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useReportData(period: Period): ReportData {
  const router = useRouter()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient() as any, [])
  const { refreshKey } = useRealtimeRefresh(['checklists'])

  const [coreLoading, setCoreLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    totalChecklists: 0, completedToday: 0, avgPerDay: 0,
    activeUsers: 0, activeStores: 0, activeTemplates: 0,
  })
  const [storeStats, setStoreStats] = useState<StoreStats[]>([])
  const [templateStats, setTemplateStats] = useState<TemplateStats[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [sectorStats, setSectorStats] = useState<SectorStats[]>([])
  const [requiredActions, setRequiredActions] = useState<RequiredAction[]>([])
  const [rawActiveChecklists, setRawActiveChecklists] = useState<RawChecklist[]>([])
  const [rawTemplates, setRawTemplates] = useState<{ id: number; name: string }[]>([])
  const [rawStores, setRawStores] = useState<{ id: number; name: string }[]>([])
  const [rawUsers, setRawUsers] = useState<{ id: string; full_name: string }[]>([])
  const [rawVisibility, setRawVisibility] = useState<{ template_id: number; store_id: number }[]>([])
  const [rawChartDays, setRawChartDays] = useState(30)
  const [rawOverdueCount, setRawOverdueCount] = useState(0)
  const [userChecklists, setUserChecklists] = useState<UserChecklist[]>([])
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string }[]>([])
  const [allStoresSimple, setAllStoresSimple] = useState<{ id: number; name: string }[]>([])
  const [allTemplatesSimple, setAllTemplatesSimple] = useState<{ id: number; name: string }[]>([])
  const [complianceSummary, setComplianceSummary] = useState<ComplianceSummary>({
    totalNonConformities: 0, complianceRate: 100, plansCreated: 0, plansResolved: 0, plansOverdue: 0,
  })
  const [complianceByField, setComplianceByField] = useState<FieldComplianceRow[]>([])
  const [complianceByStore, setComplianceByStore] = useState<StoreComplianceRow[]>([])
  const [heatmapData, setHeatmapData] = useState<{ cells: HeatmapCell[]; stores: string[]; fields: string[] }>({
    cells: [], stores: [], fields: [],
  })
  const [reincSummary, setReincSummary] = useState<ReincidenciaSummary>({
    totalReincidencias: 0, avgReincidenciaRate: 0, worstField: null, worstStore: null,
  })
  const [reincRows, setReincRows] = useState<ReincidenciaRow[]>([])
  const [assigneeStats, setAssigneeStats] = useState<AssigneeStats[]>([])

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchReportData = async () => {
    if (!isSupabaseConfigured || !supabase) { setCoreLoading(false); setAnalyticsLoading(false); return }

    setFetchError(null)
    setDataWarning(null)

    let userId: string | null = null
    let isAdminUser = false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
        isAdminUser = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
      }
    } catch {
      logInfo('[Relatorios] Falha ao verificar online, tentando cache...')
    }

    if (!userId) {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          userId = cachedAuth.userId
          const cachedUser = await getUserCache(cachedAuth.userId)
          isAdminUser = cachedUser?.is_admin || false
        }
      } catch {
        logInfo('[Relatorios] Falha ao buscar cache')
      }
    }

    if (!userId) { router.push(APP_CONFIG.routes.login); return }
    if (!isAdminUser) { router.push(APP_CONFIG.routes.dashboard); return }

    try {
      setIsOffline(false)
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [
        usersRes, storesRes, templatesRes, todayCountRes, periodCountRes,
        storesData, templatesData, allChecklists, sectorsData,
        actionPlansData, allUsersData, visibilityData,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        supabase.from('checklists').select('id', { count: 'exact', head: true }).gte('created_at', startDate.toISOString()),
        supabase.from('stores').select('id, name').eq('is_active', true),
        supabase.from('checklist_templates').select('id, name').eq('is_active', true),
        supabase.from('checklists')
          .select('id, store_id, template_id, sector_id, status, created_by, started_at, created_at, completed_at', { count: 'exact' })
          .gte('created_at', startDate.toISOString()),
        supabase.from('sectors').select('id, name, store_id, store:stores(name)').eq('is_active', true),
        supabase.from('action_plans')
          .select('id, store_id, field_id, status, severity, deadline, assigned_to, created_at, store:stores(name), field:template_fields(name)')
          .in('status', ['aberto', 'em_andamento', 'vencido'])
          .order('deadline', { ascending: true })
          .limit(5),
        supabase.from('users').select('id, full_name, function_ref:functions(name)'),
        supabase.from('template_visibility').select('template_id, store_id'),
      ])

      // ── Critical error check ──────────────────────────────────────────────────
      const criticalErrors = [
        { name: 'checklists', res: allChecklists },
        { name: 'stores', res: storesData },
        { name: 'templates', res: templatesData },
        { name: 'users', res: allUsersData },
      ].filter(q => q.res.error)

      if (criticalErrors.length > 0) {
        logError('[Relatorios] Erro em queries criticas', {
          queries: criticalErrors.map(e => e.name),
          errors: criticalErrors.map(e => ({ query: e.name, message: e.res.error?.message })),
        })
        setFetchError('Erro ao carregar dados dos relatorios. Tente recarregar a pagina.')
      }

      setSummary({
        totalChecklists: periodCountRes.count || 0,
        completedToday: todayCountRes.count || 0,
        avgPerDay: Math.round((periodCountRes.count || 0) / days * 10) / 10,
        activeUsers: usersRes.count || 0,
        activeStores: storesRes.count || 0,
        activeTemplates: templatesRes.count || 0,
      })

      // ── Checklist pagination ────────────────────────────────────────────────
      let checklistRows: RawChecklist[] = allChecklists.data || []
      const totalChecklistCount = allChecklists.count || 0
      const MAX_ROWS = 5000
      let warningSet = false
      if (totalChecklistCount > checklistRows.length) {
        const PAGE_SIZE = 1000
        for (let offset = checklistRows.length; offset < Math.min(totalChecklistCount, MAX_ROWS); offset += PAGE_SIZE) {
          const { data: page } = await supabase.from('checklists')
            .select('id, store_id, template_id, sector_id, status, created_by, started_at, created_at, completed_at')
            .gte('created_at', startDate.toISOString())
            .range(offset, offset + PAGE_SIZE - 1)
          if (page) checklistRows = checklistRows.concat(page)
        }
        if (totalChecklistCount > MAX_ROWS) {
          setDataWarning(`Exibindo ${MAX_ROWS} de ${totalChecklistCount} checklists no periodo.`)
          warningSet = true
        }
      }

      const checklists: RawChecklist[] = checklistRows

      // Store stats
      if (storesData.data) {
        const storeStatsData = storesData.data.map((store: { id: number; name: string }) => {
          const sc = checklists.filter(c => c.store_id === store.id)
          const tc = sc.filter(c => new Date(c.created_at) >= today)
          return {
            store_id: store.id,
            store_name: store.name,
            total_checklists: sc.length,
            completed_today: tc.length,
            completion_rate: sc.length ? Math.round((sc.length / days) * 100) / 100 : 0,
          }
        })
        setStoreStats(storeStatsData.sort((a: StoreStats, b: StoreStats) => b.total_checklists - a.total_checklists))
      }

      // Template stats
      if (templatesData.data) {
        const templateStatsData = templatesData.data.map((template: { id: number; name: string }) => ({
          template_id: template.id,
          template_name: template.name,
          total_uses: checklists.filter(c => c.template_id === template.id).length,
          avg_completion_time: 0,
        }))
        setTemplateStats(templateStatsData.sort((a: TemplateStats, b: TemplateStats) => b.total_uses - a.total_uses))
      }

      // Daily stats
      const chartDays = Math.min(days, 30)
      const dailyData: DailyStats[] = []
      for (let i = chartDays - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        date.setHours(0, 0, 0, 0)
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)
        dailyData.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count: checklists.filter(c => { const d = new Date(c.created_at); return d >= date && d < nextDate }).length,
        })
      }
      setDailyStats(dailyData)

      // Sector stats
      const sectors = sectorsData?.data || []
      const usersLookup = allUsersData?.data || []
      const actionPlans = actionPlansData?.data || []

      if (sectors.length > 0) {
        setSectorStats(
          sectors.map((sector: { id: number; name: string; store_id: number; store: { name: string } | null }) => {
            const sc = checklists.filter(c => c.sector_id === sector.id)
            const completed = sc.filter(c => c.status === 'concluido' || c.status === 'validado').length
            return {
              sector_id: sector.id,
              sector_name: sector.name,
              store_name: sector.store?.name || '',
              total_checklists: sc.length,
              completed,
              completion_rate: sc.length > 0 ? Math.round((completed / sc.length) * 100) : 0,
            }
          }).sort((a: SectorStats, b: SectorStats) => b.completion_rate - a.completion_rate)
        )
      } else {
        setSectorStats([])
      }

      // Required actions
      if (actionPlans.length > 0) {
        const now = new Date()
        setRequiredActions(actionPlans.map((ap: {
          status: string; deadline: string | null; assigned_to: string | null;
          store: { name: string } | null; field: { name: string } | null;
        }) => {
          const assignee = usersLookup.find((u: { id: string }) => u.id === ap.assigned_to)
          const assigneeName = assignee?.full_name || 'Não atribuído'
          const responsible = assignee?.function_ref?.name
            ? `${assigneeName} — ${assignee.function_ref.name}`
            : assigneeName

          let deadlineStr = 'Sem prazo'
          let deadlineColor = 'bg-gray-500'
          if (ap.deadline) {
            const dl = new Date(ap.deadline)
            deadlineStr = dl.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            deadlineColor = diff <= 0 ? 'bg-error' : diff <= 7 ? 'bg-warning' : 'bg-success'
          }
          return {
            text: `${ap.field?.name || 'Campo desconhecido'} — ${ap.store?.name || 'Loja desconhecida'}`,
            responsible,
            deadline: deadlineStr,
            deadlineColor,
          }
        }))
      } else {
        setRequiredActions([])
      }

      // Raw data for adherence memos
      const storesForAdh = (storesData.data || []).map((s: { id: number; name: string }) => ({ id: s.id, name: s.name }))
      const templatesForAdh = (templatesData.data || []).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name }))
      const usersForAdh = usersLookup.map((u: { id: string; full_name: string }) => ({ id: u.id, full_name: u.full_name || 'Desconhecido' }))
      const activeTemplateIds = new Set(templatesForAdh.map((t: { id: number }) => t.id))
      const activeStoreIds = new Set(storesForAdh.map((s: { id: number }) => s.id))
      const activeChecklists = checklists.filter(c => activeTemplateIds.has(c.template_id) && activeStoreIds.has(c.store_id))

      setRawActiveChecklists(activeChecklists)
      setRawTemplates(templatesForAdh)
      setRawStores(storesForAdh)
      setRawUsers(usersForAdh)
      setRawVisibility(visibilityData?.data || [])
      setRawChartDays(chartDays)
      setRawOverdueCount(actionPlans.filter((ap: { status: string }) => ap.status === 'vencido').length)

      // Core data is ready — unblock the UI
      setCoreLoading(false)

      // Responses tab data (latest checklists with joins)
      const { data: userChecklistsData, error: userChecklistsError, count: userChecklistsCount } = await supabase
        .from('checklists')
        .select(`
          id, status, created_at, completed_at, created_by,
          user:users!checklists_created_by_fkey(full_name, email),
          store:stores(name),
          template:checklist_templates(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(1000)

      if (userChecklistsError) {
        logError('[Relatorios] Erro ao buscar checklists de usuarios', { error: userChecklistsError.message })
      }

      // ── User checklists pagination ──────────────────────────────────────────
      let ucRows = userChecklistsData || []
      const ucTotal = userChecklistsCount || 0
      if (ucTotal > ucRows.length) {
        for (let offset = ucRows.length; offset < Math.min(ucTotal, 3000); offset += 1000) {
          const { data: page } = await supabase
            .from('checklists')
            .select(`
              id, status, created_at, completed_at, created_by,
              user:users!checklists_created_by_fkey(full_name, email),
              store:stores(name),
              template:checklist_templates(name)
            `)
            .order('created_at', { ascending: false })
            .range(offset, offset + 999)
          if (page) ucRows = ucRows.concat(page)
        }
        if (ucTotal > 3000 && !warningSet) {
          setDataWarning(`Exibindo ${Math.min(ucRows.length, 3000)} de ${ucTotal} checklists na aba Respostas.`)
        }
      }

      if (ucRows.length > 0) {
        const mapped = ucRows.map((c: {
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

        const usersMap = new Map<string, { id: string; name: string; email: string }>()
        const storesMap = new Map<string, { id: number; name: string }>()
        const templatesMap = new Map<string, { id: number; name: string }>()
        for (const c of ucRows) {
          if (c.created_by && c.user) usersMap.set(c.created_by, { id: c.created_by, name: c.user.full_name || c.user.email, email: c.user.email })
          if (c.store) storesMap.set(c.store.name, { id: 0, name: c.store.name })
          if (c.template) templatesMap.set(c.template.name, { id: 0, name: c.template.name })
        }
        setAllUsers(Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setAllStoresSimple(Array.from(storesMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
        setAllTemplatesSimple(Array.from(templatesMap.values()).sort((a, b) => a.name.localeCompare(b.name)))
      }

      // Analytics tabs
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
        logWarn('[Relatorios] Erro ao buscar analytics (tabelas podem nao existir ainda)', {
          error: analyticsErr instanceof Error ? analyticsErr.message : String(analyticsErr),
        })
      }

      setAnalyticsLoading(false)
    } catch (error) {
      logError('[Relatorios] Erro ao buscar dados', { error: error instanceof Error ? error.message : String(error) })
      setIsOffline(true)
      setCoreLoading(false)
      setAnalyticsLoading(false)
    }
  }

  useEffect(() => { fetchReportData() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (refreshKey > 0 && navigator.onLine) fetchReportData() }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    coreLoading, analyticsLoading, isOffline, fetchError, dataWarning,
    summary, storeStats, templateStats, dailyStats,
    sectorStats, requiredActions, rawActiveChecklists, rawTemplates, rawStores,
    rawUsers, rawVisibility, rawChartDays, rawOverdueCount,
    userChecklists, allUsers, allStoresSimple, allTemplatesSimple,
    complianceSummary, complianceByField, complianceByStore, heatmapData,
    reincSummary, reincRows, assigneeStats, supabase,
  }
}
