'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useRealtimeDashboard } from '@/hooks/useRealtimeDashboard'
import { APP_CONFIG } from '@/lib/config'
import type { User } from '@supabase/supabase-js'
import type { Store, ChecklistTemplate, Checklist, Sector, FunctionRow } from '@/types/database'
import { LoadingPage, PageContainer } from '@/components/ui'
import { FiClipboard, FiClock, FiCheckCircle, FiUser, FiCalendar, FiAlertCircle, FiRefreshCw, FiAlertTriangle, FiUploadCloud, FiLayers, FiPlay, FiArrowRight, FiCloudOff, FiBell, FiTool, FiExternalLink, FiBarChart2, FiChevronRight } from 'react-icons/fi'
import Link from 'next/link'
import {
  getAuthCache,
  getUserCache,
  getStoresCache,
  getTemplatesCache,
  getFunctionsCache,
  getSectorsCache,
  getTemplateVisibilityCache,
  getChecklistsCache,
  getChecklistSectionsCache,
  getUserStoresCache,
  getActionPlansCache,
  cacheAllDataForOffline,
} from '@/lib/offlineCache'
import { getPendingChecklists, type PendingChecklist } from '@/lib/offlineStorage'
import { syncAll, subscribeSyncStatus } from '@/lib/syncService'
import { fullLogout } from '@/lib/logout'
import { isWithinTimeRange } from '@/lib/timeUtils'

type TemplateSection = {
  id: number
  template_id: number
  name: string
  description: string | null
  sort_order: number
}

type TemplateWithVisibility = ChecklistTemplate & {
  template_visibility: Array<{
    store_id: number
    sector_id: number | null
    function_id: number | null
    store: Store
    sector: Sector | null
    function_ref: FunctionRow | null
  }>
  template_sections?: TemplateSection[]
}

type UserStoreEntry = {
  id: number
  store_id: number
  sector_id: number | null
  is_primary: boolean
  store: Store
  sector: Sector | null
}

type UserProfile = {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  is_tech: boolean
  store_id: number | null
  function_id: number | null
  sector_id: number | null
  store: Store | null
  function_ref: FunctionRow | null
  sector: Sector | null
  user_stores?: UserStoreEntry[]
}

type ChecklistWithDetails = Checklist & {
  template: ChecklistTemplate
  store: Store
  sector: Sector | null
  user?: { full_name: string } | null
}

type InProgressChecklist = {
  id: number
  template_id: number
  store_id: number
  created_at: string
  template: { id: number; name: string; category: string | null; allowed_start_time?: string | null; allowed_end_time?: string | null }
  store: { id: number; name: string }
  totalSections: number
  completedSections: number
  user_name?: string | null
}

type UserStats = {
  completedToday: number
  completedThisWeek: number
  completedThisMonth: number
  inProgress: number
  pendingSync: number
}

type ActionPlanItem = {
  id: number
  title: string
  severity: string
  status: string
  deadline: string | null
  created_at: string
  is_reincidencia: boolean
  store: { id: number; name: string } | null
}

type NotificationItem = {
  id: number
  title: string
  message: string | null
  type: string
  is_read: boolean
  created_at: string
  action_url: string | null
}


/** Retorna true se o template nao tem restricao de horario ou se a hora atual esta dentro da janela permitida */
function isTemplateWithinAllowedTime(template: { allowed_start_time?: string | null; allowed_end_time?: string | null; name?: string }): boolean {
  if (!template?.allowed_start_time || !template?.allowed_end_time) return true
  const result = isWithinTimeRange(String(template.allowed_start_time), String(template.allowed_end_time))
  console.log(`[Dashboard] TimeCheck template "${template.name || '?'}": ${result ? 'DENTRO do horario' : 'FORA do horario'}`)
  return result
}

/**
 * Tela inicial do operador (`/dashboard`).
 * Exibe checklists pendentes do dia, resumo de atividade recente e acesso rápido
 * para iniciar novos checklists. Filtra templates pelo horário permitido via `isTemplateWithinAllowedTime`.
 * Suporta dados offline via `useOfflineData`.
 */
export default function DashboardPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [templates, setTemplates] = useState<TemplateWithVisibility[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [selectedStore, setSelectedStore] = useState<number | null>(null)
  const [recentChecklists, setRecentChecklists] = useState<ChecklistWithDetails[]>([])
  const [pendingChecklists, setPendingChecklists] = useState<PendingChecklist[]>([])
  const [inProgressChecklists, setInProgressChecklists] = useState<InProgressChecklist[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [stats, setStats] = useState<UserStats>({
    completedToday: 0,
    completedThisWeek: 0,
    completedThisMonth: 0,
    inProgress: 0,
    pendingSync: 0,
  })
  const [pendingActionPlans, setPendingActionPlans] = useState(0)
  const [myActionPlans, setMyActionPlans] = useState<ActionPlanItem[]>([])
  const [myNotifications, setMyNotifications] = useState<NotificationItem[]>([])
  const [todayInProgressMap, setTodayInProgressMap] = useState<Record<string, number>>({}) // key: templateId-storeId -> checklistId
  const [todayCompletedSet, setTodayCompletedSet] = useState<Set<string>>(new Set()) // key: templateId-storeId
  const [timeBypassStoreIds, setTimeBypassStoreIds] = useState<number[] | 'all' | null>(null)
  const [loading, setLoading] = useState(true)
  const [notLoggedIn, setNotLoggedIn] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isOffline, setIsOffline] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default')
  const [notificationBannerMounted, setNotificationBannerMounted] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Realtime: derive store IDs from allStores for subscriptions
  const realtimeStoreIds = useMemo(() => allStores.map(s => s.id), [allStores])

  // Realtime dashboard subscriptions (only active when online)
  const { refreshTrigger } = useRealtimeDashboard({
    userId: profile?.id ?? null,
    userFunctionId: profile?.function_id ?? null,
    storeIds: realtimeStoreIds,
  })

  // Monitora status de conexao
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    setIsOffline(!navigator.onLine)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Permissao de notificacoes do sistema (para o banner)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
    }
    setNotificationBannerMounted(true)
  }, [])

  useEffect(() => {
    fetchData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchData()
      } else if (event === 'SIGNED_OUT') {
        setNotLoggedIn(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (notLoggedIn && !loading) {
      router.push(APP_CONFIG.routes.login)
    }
  }, [notLoggedIn, loading, router])

  // Subscreve ao status de sincronizacao
  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(async (status) => {
      console.log('[Dashboard] Sync status changed:', status)

      if (!status.isSyncing && status.lastSyncAt) {
        const pending = await getPendingChecklists()
        setPendingChecklists(pending)
        setStats(prev => ({
          ...prev,
          pendingSync: pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length,
        }))

        if (navigator.onLine) {
          fetchData()
        }
      }
    })

    return () => unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchData = async () => {
    // Se offline, carrega do cache
    if (!navigator.onLine) {
      console.log('[Dashboard] Modo offline - carregando do cache')
      await loadFromCache()
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const hasCache = await loadFromCache()
      if (!hasCache) {
        setNotLoggedIn(true)
      }
      setLoading(false)
      return
    }
    setUser(user)

    // Fetch user profile with store, function, sector joins + multi-lojas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileData } = await (supabase as any)
      .from('users')
      .select(`
        *,
        store:stores!users_store_id_fkey(*),
        function_ref:functions!users_function_id_fkey(*),
        sector:sectors!users_sector_id_fkey(*),
        user_stores(
          id,
          store_id,
          sector_id,
          is_primary,
          store:stores(*),
          sector:sectors(*)
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileData) {
      setProfile(profileData as UserProfile)
    }

    // Fetch time bypass settings
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const bypassRes = await fetch('/api/settings?keys=ignore_time_restrictions,ignore_time_restrictions_stores', {
        headers: { 'x-supabase-auth': token },
      })
      if (bypassRes.ok) {
        const settings: { key: string; value: string }[] = await bypassRes.json()
        const toggle = settings.find(s => s.key === 'ignore_time_restrictions')?.value
        if (toggle === 'true') {
          const storesValue = settings.find(s => s.key === 'ignore_time_restrictions_stores')?.value
          if (!storesValue || storesValue === 'all') {
            console.log('[Dashboard] Bypass de horario: ATIVO para TODAS as lojas')
            setTimeBypassStoreIds('all')
          } else {
            try {
              const parsed = JSON.parse(storesValue)
              console.log('[Dashboard] Bypass de horario: ATIVO para lojas:', parsed)
              setTimeBypassStoreIds(parsed)
            } catch {
              console.log('[Dashboard] Bypass de horario: ATIVO (fallback all)')
              setTimeBypassStoreIds('all')
            }
          }
        } else {
          console.log('[Dashboard] Bypass de horario: INATIVO')
          setTimeBypassStoreIds(null)
        }
      }
    } catch { /* ignore */ }

    // Fetch stores based on role
    if (profileData?.is_admin) {
      // Admin: all stores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: storesData } = await (supabase as any)
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (storesData && storesData.length > 0) {
        setAllStores(storesData as Store[])
        setSelectedStore((storesData[0] as Store).id)
      }
    } else if (profileData?.user_stores && profileData.user_stores.length > 0) {
      // Employee/Manager: multiple stores via user_stores
      const userStores = (profileData.user_stores as UserStoreEntry[])
        .map(us => us.store)
        .filter(Boolean) as Store[]
      setAllStores(userStores)
      const primary = (profileData.user_stores as UserStoreEntry[]).find(us => us.is_primary)
      setSelectedStore(primary ? primary.store_id : userStores[0]?.id || null)
    } else if (profileData?.store) {
      // Fallback legado: single store
      setAllStores([profileData.store as Store])
      setSelectedStore((profileData.store as Store).id)
    }

    // Fetch templates with visibility info + sections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templatesData } = await (supabase as any)
      .from('checklist_templates')
      .select(`
        *,
        template_visibility(
          store_id,
          sector_id,
          function_id,
          store:stores(*),
          sector:sectors(*),
          function_ref:functions(*)
        ),
        template_sections(id, template_id, name, description, sort_order)
      `)
      .eq('is_active', true)

    if (templatesData) {
      setTemplates(templatesData as TemplateWithVisibility[])
    }

    // Fetch recent checklists based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let checklistQuery = (supabase as any)
      .from('checklists')
      .select(`
        *,
        template:checklist_templates(*),
        store:stores(*),
        sector:sectors(*),
        user:users!checklists_created_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (!profileData?.is_admin) {
      // Usuario normal: apenas seus proprios checklists
      checklistQuery = checklistQuery.eq('created_by', user.id)
    }

    const { data: checklistsData } = await checklistQuery

    if (checklistsData) {
      setRecentChecklists(checklistsData as ChecklistWithDetails[])
    }

    // Fetch in-progress sectioned checklists for "Continuar Preenchimento"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let inProgressQuery = (supabase as any)
      .from('checklists')
      .select(`
        id, template_id, store_id, created_at,
        template:checklist_templates(id, name, category, allowed_start_time, allowed_end_time),
        store:stores(id, name),
        checklist_sections(id, section_id, status),
        user:users!checklists_created_by_fkey(full_name)
      `)
      .eq('status', 'em_andamento')
      .order('created_at', { ascending: false })

    if (!profileData?.is_admin) {
      inProgressQuery = inProgressQuery.eq('created_by', user.id)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inProgressData } = await inProgressQuery

    if (inProgressData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withProgress = (inProgressData as any[])
        .map(c => ({
          id: c.id,
          template_id: c.template_id,
          store_id: c.store_id,
          created_at: c.created_at,
          template: c.template,
          store: c.store,
          totalSections: c.checklist_sections?.length || 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          completedSections: c.checklist_sections?.filter((s: any) => s.status === 'concluido').length || 0,
          user_name: c.user?.full_name || null,
        }))
      setInProgressChecklists(withProgress)

      // Build todayInProgressMap: template+store -> checklist id (for today only)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayMap: Record<string, number> = {}
      for (const c of withProgress) {
        if (new Date(c.created_at) >= todayStart) {
          todayMap[`${c.template_id}-${c.store_id}`] = c.id
        }
      }
      setTodayInProgressMap(todayMap)
    }

    // Fetch today's completed/incompleto checklists to block re-starting
    const todayStartForCompleted = new Date()
    todayStartForCompleted.setHours(0, 0, 0, 0)
    const todayCompletedISO = new Date(todayStartForCompleted.getTime() - todayStartForCompleted.getTimezoneOffset() * 60000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let completedTodayQuery = (supabase as any)
      .from('checklists')
      .select('template_id, store_id')
      .in('status', ['concluido', 'incompleto', 'validado'])
      .gte('created_at', todayCompletedISO)

    if (!profileData?.is_admin) {
      completedTodayQuery = completedTodayQuery.eq('created_by', user.id)
    }

    const { data: completedTodayData } = await completedTodayQuery

    if (completedTodayData) {
      const completedSet = new Set<string>()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of completedTodayData as any[]) {
        completedSet.add(`${c.template_id}-${c.store_id}`)
      }
      setTodayCompletedSet(completedSet)
    }

    // Fetch pending offline checklists
    try {
      const pending = await getPendingChecklists()
      setPendingChecklists(pending)
      console.log('[Dashboard] Checklists pendentes:', pending.length)
    } catch (err) {
      console.error('[Dashboard] Erro ao buscar checklists pendentes:', err)
    }

    // Calculate stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayISO = new Date(todayStart.getTime() - todayStart.getTimezoneOffset() * 60000).toISOString()

    const weekAgo = new Date(todayStart)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoISO = new Date(weekAgo.getTime() - weekAgo.getTimezoneOffset() * 60000).toISOString()

    const monthAgo = new Date(todayStart)
    monthAgo.setDate(monthAgo.getDate() - 30)
    const monthAgoISO = new Date(monthAgo.getTime() - monthAgo.getTimezoneOffset() * 60000).toISOString()

    // Stats queries: admin ve tudo, usuario ve so dele
    const isAdminUser = profileData?.is_admin === true

    // Helper to apply the right filter based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const applyStatsFilter = (query: any) => {
      if (isAdminUser) return query // Admin: sem filtro
      return query.eq('created_by', user.id) // Usuario normal
    }

    const [todayRes, weekRes, monthRes, inProgressRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyStatsFilter((supabase as any)
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'concluido')
        .gte('created_at', todayISO)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyStatsFilter((supabase as any)
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'concluido')
        .gte('created_at', weekAgoISO)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyStatsFilter((supabase as any)
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'concluido')
        .gte('created_at', monthAgoISO)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyStatsFilter((supabase as any)
        .from('checklists')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'em_andamento')),
    ])

    let pendingSyncCount = 0
    try {
      const pending = await getPendingChecklists()
      pendingSyncCount = pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length
    } catch {
      // Ignore errors
    }

    setStats({
      completedToday: todayRes.count || 0,
      completedThisWeek: weekRes.count || 0,
      completedThisMonth: monthRes.count || 0,
      inProgress: inProgressRes.count || 0,
      pendingSync: pendingSyncCount,
    })

    // Filtro de planos: usuario direto OU funcao do usuario
    const userFunctionId = profileData?.function_id
    const apFilter = userFunctionId
      ? `assigned_to.eq.${user.id},assigned_function_id.eq.${userFunctionId}`
      : `assigned_to.eq.${user.id}`

    // Buscar planos de acao pendentes do usuario
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: apCount } = await (supabase as any)
        .from('action_plans')
        .select('id', { count: 'exact', head: true })
        .or(apFilter)
        .in('status', ['aberto', 'em_andamento'])

      setPendingActionPlans(apCount || 0)
    } catch {
      // Tabela pode nao existir ainda
    }

    // Dados extras para usuarios tecnicos
    const isTechProfile = profileData?.is_tech === true
    if (isTechProfile) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [apRes, notifRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('action_plans')
            .select(`id, title, severity, status, deadline, created_at, is_reincidencia, store:stores!action_plans_store_id_fkey(id, name)`)
            .or(apFilter)
            .neq('status', 'cancelado')
            .order('created_at', { ascending: false })
            .limit(20),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from('notifications')
            .select('id, title, message, type, is_read, created_at, action_url')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(10),
        ])
        if (apRes.data) setMyActionPlans(apRes.data as ActionPlanItem[])
        if (notifRes.data) setMyNotifications(notifRes.data as NotificationItem[])
      } catch {
        // Tabelas podem nao existir ainda
      }
    }

    // Verificar planos vencidos (piggyback no login do admin)
    if (profileData?.is_admin) {
      try {
        const { checkOverduePlans } = await import('@/lib/actionPlanEngine')
        const { data: { session } } = await supabase.auth.getSession()
        await checkOverduePlans(supabase, session?.access_token)
      } catch {
        // Engine pode nao estar disponivel
      }
    }

    setLoading(false)

    // Atualiza cache offline em background
    cacheAllDataForOffline(user.id).catch(err => {
      console.warn('[Dashboard] Erro ao atualizar cache offline em background:', err)
    })
  }

  /**
   * Carrega dados do cache IndexedDB para modo offline
   */
  const loadFromCache = async (): Promise<boolean> => {
    try {
      console.log('[Dashboard] Carregando dados do cache...')

      const cachedAuth = await getAuthCache()
      if (!cachedAuth) {
        console.log('[Dashboard] Sem auth no cache')
        return false
      }

      const cachedUser = await getUserCache(cachedAuth.userId)
      if (!cachedUser) {
        console.log('[Dashboard] Sem usuario no cache')
        return false
      }

      // Busca dados auxiliares do cache
      const cachedStores = await getStoresCache()
      const cachedFunctions = await getFunctionsCache()
      const cachedSectors = await getSectorsCache()
      const cachedUserStores = await getUserStoresCache(cachedAuth.userId)

      // Reconstroi function_ref e sector a partir do cache
      const userFunction = cachedUser.function_id
        ? cachedFunctions.find(f => f.id === cachedUser.function_id) || null
        : null
      const userSector = cachedUser.sector_id
        ? cachedSectors.find(s => s.id === cachedUser.sector_id) || null
        : null
      const userStore = cachedUser.store_id
        ? cachedStores.find(s => s.id === cachedUser.store_id) || null
        : null

      // Reconstroi user_stores com objetos completos
      const userStoresWithDetails: UserStoreEntry[] = cachedUserStores.map(us => ({
        id: us.id,
        store_id: us.store_id,
        sector_id: us.sector_id,
        is_primary: us.is_primary,
        store: cachedStores.find(s => s.id === us.store_id) || { id: us.store_id, name: '' } as Store,
        sector: us.sector_id ? cachedSectors.find(s => s.id === us.sector_id) || null : null,
      }))

      setProfile({
        id: cachedUser.id,
        email: cachedUser.email,
        full_name: cachedUser.full_name,
        is_admin: cachedUser.is_admin || false,
        is_tech: cachedUser.is_tech || false,
        store_id: cachedUser.store_id || null,
        function_id: cachedUser.function_id || null,
        sector_id: cachedUser.sector_id || null,
        store: userStore,
        function_ref: userFunction,
        sector: userSector,
        user_stores: userStoresWithDetails.length > 0 ? userStoresWithDetails : undefined,
      })

      // Configura lojas acessiveis
      if (cachedStores.length > 0) {
        if (cachedUser.is_admin) {
          setAllStores(cachedStores)
          setSelectedStore(cachedStores[0].id)
        } else if (userStoresWithDetails.length > 0) {
          // Multi-loja
          const stores = userStoresWithDetails.map(us => us.store).filter(Boolean)
          setAllStores(stores)
          const primary = userStoresWithDetails.find(us => us.is_primary)
          setSelectedStore(primary ? primary.store_id : stores[0]?.id || null)
        } else if (cachedUser.store_id) {
          const store = cachedStores.find(s => s.id === cachedUser.store_id)
          if (store) {
            setAllStores([store])
            setSelectedStore(store.id)
          }
        }
      }

      // Templates com visibilidade REAL do cache
      const cachedTemplatesRaw = await getTemplatesCache()
      const cachedTemplates = cachedTemplatesRaw.filter(t => t.is_active)
      const cachedVisibility = await getTemplateVisibilityCache()

      if (cachedTemplates.length > 0) {
        const templatesWithVisibility = cachedTemplates.map(template => {
          const visibilityRows = cachedVisibility.filter(v => v.template_id === template.id)
          return {
            ...template,
            template_visibility: visibilityRows.map(v => ({
              store_id: v.store_id,
              sector_id: v.sector_id,
              function_id: v.function_id,
              store: cachedStores.find(s => s.id === v.store_id) || { id: v.store_id, name: '' } as Store,
              sector: v.sector_id ? cachedSectors.find(s => s.id === v.sector_id) || null : null,
              function_ref: v.function_id ? cachedFunctions.find(f => f.id === v.function_id) || null : null,
            })),
          }
        }) as TemplateWithVisibility[]

        setTemplates(templatesWithVisibility)
      }

      // Historico recente do cache
      const cachedChecklists = await getChecklistsCache()
      if (cachedChecklists.length > 0) {
        const userId = cachedAuth.userId

        // Filtra por usuario (admin ve todos)
        const filteredChecklists = cachedUser.is_admin
          ? cachedChecklists
          : cachedChecklists.filter(c => c.created_by === userId)

        // Ordena por created_at desc e pega os 10 mais recentes
        const sorted = [...filteredChecklists].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const recent = sorted.slice(0, 10)

        // Mapeia para o formato esperado pelo componente
        const recentWithDetails: ChecklistWithDetails[] = recent.map(c => ({
          ...c,
          template: { id: c.template_id, name: c.template_name || 'Checklist', category: c.template_category || null } as ChecklistTemplate,
          store: { id: c.store_id, name: c.store_name || 'Loja' } as Store,
          sector: c.sector_name ? { id: c.sector_id || 0, name: c.sector_name } as Sector : null,
          user: c.user_name ? { full_name: c.user_name } : null,
        }))

        setRecentChecklists(recentWithDetails)

        // In-progress checklists (Continuar Preenchimento)
        const inProgress = filteredChecklists.filter(c => c.status === 'em_andamento')
        if (inProgress.length > 0) {
          const cachedClSections = await getChecklistSectionsCache()

          const inProgressWithSections: InProgressChecklist[] = inProgress.map(c => {
            const clSections = cachedClSections.filter(s => s.checklist_id === c.id)
            return {
              id: c.id,
              template_id: c.template_id,
              store_id: c.store_id,
              created_at: c.created_at,
              template: { id: c.template_id, name: c.template_name || 'Checklist', category: c.template_category || null },
              store: { id: c.store_id, name: c.store_name || 'Loja' },
              totalSections: clSections.length,
              completedSections: clSections.filter(s => s.status === 'concluido').length,
              user_name: c.user_name || null,
            }
          }).filter(c => c.totalSections > 0)

          setInProgressChecklists(inProgressWithSections)
        }

        // Stats calculados do cache
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const weekAgo = new Date(todayStart)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const monthAgo = new Date(todayStart)
        monthAgo.setDate(monthAgo.getDate() - 30)

        const completed = filteredChecklists.filter(c => c.status === 'concluido')
        const completedToday = completed.filter(c => new Date(c.created_at) >= todayStart).length
        const completedThisWeek = completed.filter(c => new Date(c.created_at) >= weekAgo).length
        const completedThisMonth = completed.filter(c => new Date(c.created_at) >= monthAgo).length
        const inProgressCount = filteredChecklists.filter(c => c.status === 'em_andamento').length

        let pendingSyncCount = 0
        try {
          const pending = await getPendingChecklists()
          setPendingChecklists(pending)
          pendingSyncCount = pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length
        } catch {
          // Ignore errors
        }

        setStats({
          completedToday,
          completedThisWeek,
          completedThisMonth,
          inProgress: inProgressCount,
          pendingSync: pendingSyncCount,
        })
      } else {
        // Sem checklists no cache - so pending sync
        let pendingSyncCount = 0
        try {
          const pending = await getPendingChecklists()
          setPendingChecklists(pending)
          pendingSyncCount = pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length
        } catch {
          // Ignore errors
        }

        setRecentChecklists([])
        setStats({
          completedToday: 0,
          completedThisWeek: 0,
          completedThisMonth: 0,
          inProgress: 0,
          pendingSync: pendingSyncCount,
        })
      }

      // Planos de acao pendentes do cache
      try {
        const cachedPlans = await getActionPlansCache(cachedAuth.userId)
        const pendingCount = cachedPlans.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length
        setPendingActionPlans(pendingCount)
      } catch {
        // Ignore - cache may not have action plans yet
      }

      setIsOffline(true)
      setLoading(false)
      console.log('[Dashboard] Dados carregados do cache com sucesso')
      return true
    } catch (error) {
      console.error('[Dashboard] Erro ao carregar cache:', error)
      return false
    }
  }

  // Realtime: refetch data when any subscribed table changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (refreshTrigger === 0) return // skip initial
    if (!navigator.onLine) return
    console.log('[Dashboard] Realtime refresh triggered:', refreshTrigger)
    fetchData()
  }, [refreshTrigger])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSignOut = async () => {
    await fullLogout(supabase)
  }

  const handleSyncNow = async () => {
    if (isSyncing || !navigator.onLine) return

    setIsSyncing(true)
    try {
      const result = await syncAll()
      console.log('[Dashboard] Sync result:', result)

      const pending = await getPendingChecklists()
      setPendingChecklists(pending)
      setStats(prev => ({
        ...prev,
        pendingSync: pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length,
      }))

      if (result.synced > 0) {
        fetchData()
      }
    } catch (err) {
      console.error('[Dashboard] Erro ao sincronizar:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  // Get stores user has access to
  const getUserStores = (): Store[] => {
    if (!profile) return []
    if (profile.is_admin) return allStores
    // Multi-loja: user_stores
    if (profile.user_stores && profile.user_stores.length > 0) {
      return profile.user_stores.map(us => us.store).filter(Boolean)
    }
    // Fallback legado: single store
    if (profile.store) return [profile.store]
    if (profile.store_id) {
      const store = allStores.find(s => s.id === profile.store_id)
      if (store) return [store]
    }
    return []
  }

  // Get available templates for the selected store
  const getAvailableTemplates = (): { template: TemplateWithVisibility; canFill: boolean }[] => {
    if (!selectedStore || !profile) return []

    // Setor do usuario na loja selecionada (multi-loja)
    const userSectorForStore = profile.user_stores?.find(
      us => us.store_id === selectedStore
    )?.sector_id || profile.sector_id

    return templates
      .filter(template => {
        // Filter by selected store visibility
        // Admin-only templates: esconder para nao-admins
        if (template.admin_only && !profile.is_admin) return false

        const visibilities = template.template_visibility?.filter(v => v.store_id === selectedStore) || []
        if (visibilities.length === 0) return false

        // Admin: see all templates that have visibility for this store
        if (profile.is_admin) return true

        // Employee: check sector + function match (usando setor da loja selecionada)
        return visibilities.some(v => {
          const sectorMatch = !v.sector_id || v.sector_id === userSectorForStore
          const functionMatch = !v.function_id || v.function_id === profile.function_id
          return sectorMatch && functionMatch
        })
      })
      .map(template => ({
        template,
        canFill: true,
      }))
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; class: string }> = {
      rascunho: { label: 'Rascunho', class: 'bg-surface-hover text-muted' },
      em_andamento: { label: 'Em Andamento', class: 'bg-warning/20 text-warning' },
      concluido: { label: 'Concluído', class: 'bg-success/20 text-success' },
      validado: { label: 'Validado', class: 'bg-info/20 text-info' },
      incompleto: { label: 'Incompleto', class: 'bg-error/20 text-error' },
    }
    return badges[status] || badges.rascunho
  }

  const stores = getUserStores()
  const availableTemplates = getAvailableTemplates()

  const isTechUser = profile?.is_tech === true

  if (loading) {
    return <LoadingPage />
  }

  if (notLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <FiUser className="w-16 h-16 text-muted mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-main mb-2">{APP_CONFIG.messages.loginRequired}</h2>
          <p className="text-muted mb-4">Redirecionando...</p>
          <Link href="/login" className="text-primary hover:underline">
            Ir para login
          </Link>
        </div>
      </div>
    )
  }

  // User has no access (no store assigned, not admin)
  if (!profile?.is_admin && stores.length === 0) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-10 h-10 text-warning" />
          </div>
          <h2 className="text-2xl font-bold text-main mb-2">
            Acesso Pendente
          </h2>
          <p className="text-muted max-w-md mx-auto mb-6">
            Sua conta ainda não foi configurada com acesso a nenhuma loja.
            Entre em contato com o administrador para liberar seu acesso.
          </p>
          <div className="card p-6 max-w-sm mx-auto">
            <p className="text-sm text-secondary mb-2">Seus dados:</p>
            <p className="font-medium text-main">{profile?.full_name}</p>
            <p className="text-sm text-muted">{profile?.email}</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <>
      {/* Aviso para ativar notificacoes do sistema (PWA) */}
      {notificationBannerMounted && typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'default' && (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="card p-4 bg-primary/10 border border-primary/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <FiBell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-main text-sm">
                  Receba avisos no celular
                </p>
                <p className="text-xs text-muted">
                  Planos de ação, vencimentos e alertas como notificação do sistema.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (typeof window === 'undefined' || !('Notification' in window)) return
                const result = await Notification.requestPermission()
                setNotificationPermission(result as 'default' | 'granted' | 'denied')
              }}
              className="btn-primary text-sm shrink-0 self-start sm:self-center"
            >
              Ativar notificações
            </button>
          </div>
        </div>
      )}

      {/* Action Plans Alert */}
      {pendingActionPlans > 0 && (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <Link
            href="/admin/planos-de-acao"
            className="card p-4 bg-warning/10 border border-warning/30 flex items-center justify-between hover:bg-warning/15 transition-colors block"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                <FiAlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="font-medium text-main">
                  Você tem {pendingActionPlans} plano{pendingActionPlans > 1 ? 's' : ''} de ação pendente{pendingActionPlans > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted">
                  Clique para ver seus planos de ação
                </p>
              </div>
            </div>
            <FiArrowRight className="w-5 h-5 text-warning shrink-0" />
          </Link>
        </div>
      )}

      {/* Main Content */}
      <PageContainer>
        {/* Stats */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted">
            {profile?.is_admin ? 'Dados do sistema' : isTechUser ? 'Meus planos de ação' : 'Seus dados'}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {isTechUser ? (
            <>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-error/20 flex items-center justify-center">
                    <FiAlertCircle className="w-5 h-5 text-error" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">
                      {myActionPlans.filter(p => p.status === 'aberto').length}
                    </p>
                    <p className="text-xs text-muted">Abertos</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                    <FiClock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">
                      {myActionPlans.filter(p => p.status === 'em_andamento').length}
                    </p>
                    <p className="text-xs text-muted">Em Andamento</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                    <FiCheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">
                      {myActionPlans.filter(p => p.status === 'concluido').length}
                    </p>
                    <p className="text-xs text-muted">Concluídos</p>
                  </div>
                </div>
              </div>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
                    <FiAlertTriangle className="w-5 h-5 text-error" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">
                      {myActionPlans.filter(p =>
                        p.deadline &&
                        new Date(p.deadline) < new Date() &&
                        p.status !== 'concluido'
                      ).length}
                    </p>
                    <p className="text-xs text-muted">Vencidos</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/20 flex items-center justify-center">
                    <FiCheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">{stats.completedToday}</p>
                    <p className="text-xs text-muted">Hoje</p>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                    <FiClock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">{stats.inProgress}</p>
                    <p className="text-xs text-muted">Em Andamento</p>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center">
                    <FiCalendar className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">{stats.completedThisWeek}</p>
                    <p className="text-xs text-muted">Esta Semana</p>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                    <FiClipboard className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-main">{stats.completedThisMonth}</p>
                    <p className="text-xs text-muted">Este Mês</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pending Sync Alert */}
        {stats.pendingSync > 0 && (
          <div className="card p-4 mb-8 bg-warning/10 border border-warning/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                  <FiUploadCloud className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-main">
                    {stats.pendingSync} checklist{stats.pendingSync > 1 ? 's' : ''} aguardando sincronização
                  </p>
                  <p className="text-xs text-muted">
                    {navigator.onLine ? 'Conectado - pronto para sincronizar' : 'Offline - sincronizará automaticamente quando conectar'}
                  </p>
                </div>
              </div>
              {navigator.onLine && (
                <button
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <FiRefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Link para Meus Relatórios (todos os usuarios) ── */}
        <Link
          href={APP_CONFIG.routes.userReports}
          className="card p-4 mb-6 flex items-center gap-3 hover:bg-surface-hover transition-colors"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FiBarChart2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-main">Meus Relatórios</p>
            <p className="text-xs text-muted">Veja estatísticas dos seus checklists</p>
          </div>
          <FiChevronRight className="w-4 h-4 text-muted ml-auto" />
        </Link>

        {/* ── Tech user sections ── */}
        {isTechUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Meus Planos de Ação - full width */}
            <div className="md:col-span-2 card p-5">
              <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                <FiTool className="w-5 h-5 text-primary" />
                Meus Planos de Ação
              </h2>
              {myActionPlans.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted">Nenhum plano de ação atribuído</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {myActionPlans.map(plan => {
                      const sevConfig: Record<string, { label: string; cls: string }> = {
                        critica: { label: 'CRITICA', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                        alta:    { label: 'ALTA',    cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
                        media:   { label: 'MEDIA',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
                        baixa:   { label: 'BAIXA',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                      }
                      const statusConfig: Record<string, { label: string; cls: string }> = {
                        aberto:       { label: 'Aberto',       cls: 'bg-error/20 text-error' },
                        em_andamento: { label: 'Em Andamento', cls: 'bg-warning/20 text-warning' },
                        concluido:    { label: 'Concluido',    cls: 'bg-success/20 text-success' },
                        vencido:      { label: 'Vencido',      cls: 'bg-error/20 text-error' },
                      }
                      const sev = sevConfig[plan.severity] || sevConfig.media
                      const st = statusConfig[plan.status] || statusConfig.aberto
                      const isOverdue = plan.deadline &&
                        new Date(plan.deadline) < new Date() &&
                        plan.status !== 'concluido'
                      return (
                        <a
                          key={plan.id}
                          href={`/admin/planos-de-acao/${plan.id}`}
                          className="rounded-xl border border-subtle p-4 hover:shadow-theme-md hover:border-primary/30 transition-all block"
                        >
                          <div className="flex items-start gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${sev.cls}`}>
                              {sev.label}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                            {plan.is_reincidencia && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-error/20 text-error">
                                Reincidência
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-main mb-1 line-clamp-2">{plan.title}</p>
                          <p className="text-xs text-muted">
                            {plan.store?.name}
                            {plan.deadline && (
                              <span style={{ color: isOverdue ? 'var(--color-error)' : undefined }}>
                                {` • ${new Date(plan.deadline).toLocaleDateString('pt-BR')}${isOverdue ? ' (vencido)' : ''}`}
                              </span>
                            )}
                          </p>
                        </a>
                      )
                    })}
                  </div>
                  <a
                    href="/admin/planos-de-acao"
                    className="block text-sm text-primary hover:underline text-center py-3 mt-2"
                  >
                    Ver todos os planos →
                  </a>
                </>
              )}
            </div>

            {/* Notificações */}
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                <FiBell className="w-5 h-5 text-primary" />
                Notificações
              </h2>
              {myNotifications.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted">Nenhuma notificação recente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...myNotifications]
                    .sort((a, b) => (a.is_read === b.is_read ? 0 : a.is_read ? 1 : -1))
                    .map(notif => (
                      <div
                        key={notif.id}
                        className={`rounded-xl border border-subtle p-3 ${!notif.is_read ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {!notif.is_read && (
                              <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-main truncate">{notif.title}</p>
                              {notif.message && (
                                <p className="text-xs text-muted line-clamp-2">{notif.message}</p>
                              )}
                              <p className="text-xs text-muted mt-1">
                                {new Date(notif.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          {notif.action_url && (
                            <a
                              href={notif.action_url}
                              className="shrink-0 text-primary hover:underline"
                            >
                              <FiExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Histórico Recente (preview) */}
            <div className="card p-5">
              <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                <FiClock className="w-5 h-5 text-primary" />
                Histórico Recente
              </h2>
              {recentChecklists.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm text-muted">Você ainda não preencheu nenhum checklist</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentChecklists.slice(0, 5).map(checklist => {
                    const statusBadge = getStatusBadge(checklist.status)
                    return (
                      <a
                        key={checklist.id}
                        href={`/checklist/${checklist.id}`}
                        className="rounded-xl border border-subtle p-3 hover:border-primary/30 transition-all block"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-medium text-main truncate">{checklist.template?.name}</p>
                          <span className={`badge-secondary text-xs shrink-0 ml-2 ${statusBadge.class}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted">
                          {checklist.store?.name} • {formatDate(checklist.created_at)}
                        </p>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - New Checklist */}
          <div className="lg:col-span-2">
            {/* Store Selector (admin with multiple stores) */}
            {stores.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-muted mb-3">
                  Selecione a Loja
                </label>
                <div className="flex flex-wrap gap-2">
                  {stores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => setSelectedStore(store.id)}
                      className={`px-4 py-2 rounded-xl font-medium transition-all ${
                        selectedStore === store.id
                          ? 'bg-primary text-primary-foreground shadow-theme-md'
                          : 'bg-surface text-secondary border border-subtle hover:bg-surface-hover'
                      }`}
                    >
                      {store.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single store indicator */}
            {stores.length === 1 && (
              <div className="mb-6 flex items-center gap-2">
                <p className="text-sm text-muted">
                  Loja: <span className="font-medium text-main">{stores[0].name}</span>
                </p>
              </div>
            )}

            {/* User info badges */}
            {selectedStore && !profile?.is_admin && (
              <div className="mb-6">
                <p className="text-sm text-muted mb-2">Seu perfil:</p>
                <div className="flex flex-wrap gap-2">
                  {profile?.function_ref && (
                    <span
                      className="badge-secondary text-xs flex items-center gap-1"
                      style={{ backgroundColor: profile.function_ref.color + '20', color: profile.function_ref.color }}
                    >
                      {profile.function_ref.name}
                    </span>
                  )}
                  {profile?.sector && (
                    <span
                      className="badge-secondary text-xs flex items-center gap-1"
                      style={{ backgroundColor: profile.sector.color + '20', color: profile.sector.color }}
                    >
                      {profile.sector.name}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* In-Progress Sectioned Checklists + Offline Drafts */}
            {(() => {
              const offlineDrafts = pendingChecklists.filter(c => c.syncStatus === 'draft')
              // Nao mostrar drafts que ja tem um em_andamento no DB (mesmo template+store)
              const uniqueOfflineDrafts = offlineDrafts.filter(d =>
                !inProgressChecklists.some(ip =>
                  ip.template_id === d.templateId && ip.store_id === d.storeId
                )
              )
              const hasItems = inProgressChecklists.length > 0 || uniqueOfflineDrafts.length > 0
              if (!hasItems) return null
              return (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
                    <FiPlay className="w-5 h-5 text-warning" />
                    Continuar Preenchimento
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inProgressChecklists.map(item => {
                      const hasSections = item.totalSections > 0
                      const pct = hasSections
                        ? Math.round((item.completedSections / item.totalSections) * 100)
                        : null
                      const bypassed = timeBypassStoreIds === 'all' || (Array.isArray(timeBypassStoreIds) && timeBypassStoreIds.includes(item.store_id))
                      const withinTime = bypassed || isTemplateWithinAllowedTime(item.template)
                      const cardContent = (
                        <>
                          <div className="flex items-start justify-between mb-2">
                            <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                              <FiLayers className="w-5 h-5 text-warning" />
                            </div>
                            <span className="badge-secondary text-xs bg-warning/20 text-warning">
                              {hasSections ? `${item.completedSections}/${item.totalSections} etapas` : 'Em andamento'}
                            </span>
                          </div>
                          <h3 className="font-semibold text-main mb-1 group-hover:text-primary transition-colors">
                            {item.template?.name}
                          </h3>
                          {item.user_name && (
                            <p className="text-xs text-primary/80 mb-1">
                              {item.user_name}
                            </p>
                          )}
                          <p className="text-xs text-muted mb-2">
                            {item.store?.name} - {formatDate(item.created_at)}
                          </p>
                          {!withinTime && (
                            <p className="text-xs text-warning font-medium mb-2">Fora do horário permitido</p>
                          )}
                          {hasSections && pct !== null && (
                            <>
                              <div className="w-full bg-surface-hover rounded-full h-2">
                                <div
                                  className="bg-warning h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted mt-1">{pct}% concluído</p>
                            </>
                          )}
                        </>
                      )
                      if (!withinTime) {
                        return (
                          <div
                            key={item.id}
                            className="p-5 border-l-4 border-warning rounded-xl border border-subtle bg-surface opacity-75 cursor-not-allowed"
                            title="Fora do horário permitido para preenchimento"
                          >
                            {cardContent}
                          </div>
                        )
                      }
                      return (
                        <Link
                          key={item.id}
                          href={`${APP_CONFIG.routes.checklistNew}?template=${item.template_id}&store=${item.store_id}&resume=${item.id}`}
                          className="group card-hover p-5 border-l-4 border-warning"
                        >
                          {cardContent}
                        </Link>
                      )
                    })}
                    {uniqueOfflineDrafts.map(draft => {
                      const tpl = templates.find(t => t.id === draft.templateId)
                      const store = allStores.find(s => s.id === draft.storeId)
                      const totalSections = draft.sections?.length || 0
                      const completedSections = draft.sections?.filter(s => s.status === 'concluido').length || 0
                      const hasSections = totalSections > 0
                      const pct = hasSections
                        ? Math.round((completedSections / totalSections) * 100)
                        : null
                      return (
                        <Link
                          key={draft.id}
                          href={`${APP_CONFIG.routes.checklistNew}?template=${draft.templateId}&store=${draft.storeId}`}
                          className="group card-hover p-5 border-l-4 border-warning"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
                              <FiLayers className="w-5 h-5 text-warning" />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="badge-secondary text-xs bg-surface-hover text-muted flex items-center gap-1">
                                <FiCloudOff className="w-3 h-3" />
                                Offline
                              </span>
                              <span className="badge-secondary text-xs bg-warning/20 text-warning">
                                {hasSections ? `${completedSections}/${totalSections} etapas` : 'Em andamento'}
                              </span>
                            </div>
                          </div>
                          <h3 className="font-semibold text-main mb-1 group-hover:text-primary transition-colors">
                            {tpl?.name || 'Checklist'}
                          </h3>
                          <p className="text-xs text-muted mb-2">
                            {store?.name || 'Loja'} - {formatDate(draft.createdAt)}
                          </p>
                          {hasSections && pct !== null && (
                            <>
                              <div className="w-full bg-surface-hover rounded-full h-2">
                                <div
                                  className="bg-warning h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted mt-1">{pct}% concluído</p>
                            </>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Available Checklists */}
            {(
            <>
            <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
              <FiClipboard className="w-5 h-5 text-primary" />
              Iniciar Novo Checklist
            </h2>

            {availableTemplates.length === 0 ? (
              <div className="text-center py-12 card">
                <FiClipboard className="w-12 h-12 text-muted mx-auto mb-4" />
                <p className="text-muted">
                  {APP_CONFIG.messages.noChecklists}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {availableTemplates.map(({ template }) => {
                  const sectionCount = template.template_sections?.length || 0
                  const key = `${template.id}-${selectedStore}`
                  const existingChecklistId = todayInProgressMap[key]
                  const isCompleted = todayCompletedSet.has(key)
                  const hasOfflineDraft = pendingChecklists.some(c =>
                    c.syncStatus === 'draft' &&
                    c.templateId === template.id &&
                    c.storeId === selectedStore
                  ) && !inProgressChecklists.some(ip =>
                    ip.template_id === template.id && ip.store_id === selectedStore
                  )
                  const isResume = (!!existingChecklistId || hasOfflineDraft) && !isCompleted

                  if (isCompleted) {
                    return (
                      <div
                        key={template.id}
                        className="card p-5 opacity-60 cursor-default"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                            <FiCheckCircle className="w-5 h-5 text-success" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="badge-secondary text-xs bg-success/20 text-success">
                              Concluído hoje
                            </span>
                          </div>
                        </div>
                        <h3 className="font-semibold text-main mb-1">{template.name}</h3>
                        {template.description && (
                          <p className="text-sm text-muted line-clamp-2">{template.description}</p>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={template.id}
                      href={isResume && existingChecklistId && !hasOfflineDraft
                        ? `${APP_CONFIG.routes.checklistNew}?template=${template.id}&store=${selectedStore}&resume=${existingChecklistId}`
                        : `${APP_CONFIG.routes.checklistNew}?template=${template.id}&store=${selectedStore}`
                      }
                      className={`group card-hover p-5 ${isResume ? 'border-l-4 border-warning' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          isResume ? 'bg-warning/20' : 'bg-primary/10 group-hover:bg-primary/20'
                        }`}>
                          {isResume
                            ? <FiPlay className="w-5 h-5 text-warning" />
                            : <FiClipboard className="w-5 h-5 text-primary" />
                          }
                        </div>
                        <div className="flex items-center gap-2">
                          {isResume && (
                            <span className="badge-secondary text-xs bg-warning/20 text-warning">
                              Continuar
                            </span>
                          )}
                          {sectionCount > 0 && (
                            <span className="badge-secondary text-xs flex items-center gap-1 bg-info/20 text-info">
                              <FiLayers className="w-3 h-3" />
                              {sectionCount} etapas
                            </span>
                          )}
                          <span className="badge-secondary capitalize text-xs">
                            {template.category || 'Geral'}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-semibold text-main mb-1 group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>

                      {template.description && (
                        <p className="text-sm text-muted line-clamp-2">
                          {template.description}
                        </p>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
            </>
            )}

          </div>

          {/* Right Column - Recent Checklists */}
          <div>
            <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
              <FiClock className="w-5 h-5 text-primary" />
              Histórico Recente
            </h2>

            {/* Pending Checklists (excluding drafts — those show in "Continuar Preenchimento") */}
            {(() => {
              const syncablePending = pendingChecklists.filter(c => c.syncStatus !== 'draft')
              return syncablePending.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs font-medium text-warning mb-2 flex items-center gap-1">
                    <FiUploadCloud className="w-3 h-3" />
                    Aguardando Sincronização
                  </p>
                  <div className="space-y-2">
                    {syncablePending.map(pending => {
                      const template = templates.find(t => t.id === pending.templateId)
                      const store = allStores.find(s => s.id === pending.storeId)
                      const statusColor = pending.syncStatus === 'failed'
                        ? 'bg-error/20 text-error border-error/30'
                        : pending.syncStatus === 'syncing'
                        ? 'bg-info/20 text-info border-info/30'
                        : 'bg-warning/20 text-warning border-warning/30'
                      const statusLabel = pending.syncStatus === 'failed'
                        ? 'Falhou'
                        : pending.syncStatus === 'syncing'
                        ? 'Sincronizando'
                        : 'Pendente'
                      const StatusIcon = pending.syncStatus === 'failed'
                        ? FiAlertTriangle
                        : pending.syncStatus === 'syncing'
                        ? FiRefreshCw
                        : FiUploadCloud

                      return (
                        <div
                          key={pending.id}
                          className={`card p-3 border ${statusColor.includes('error') ? 'border-error/30' : 'border-warning/30'}`}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-medium text-main text-sm">
                              {template?.name || 'Checklist'}
                            </h4>
                            <span className={`badge-secondary text-xs flex items-center gap-1 ${statusColor}`}>
                              <StatusIcon className={`w-3 h-3 ${pending.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-xs text-muted mb-1">
                            {store?.name || 'Loja'}
                          </p>
                          <p className="text-xs text-muted">
                            {formatDate(pending.createdAt)}
                          </p>
                          {pending.errorMessage && (
                            <p className="text-xs text-error mt-1">
                              {pending.errorMessage}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null
            })()}

            {/* Synced Checklists */}
            {recentChecklists.length === 0 && pendingChecklists.filter(c => c.syncStatus !== 'draft').length === 0 ? (
              <div className="card p-6 text-center">
                <FiClipboard className="w-10 h-10 text-muted mx-auto mb-3" />
                <p className="text-muted text-sm">
                  Você ainda não preencheu nenhum checklist
                </p>
              </div>
            ) : recentChecklists.length > 0 ? (
              <div className="space-y-3">
                {pendingChecklists.filter(c => c.syncStatus !== 'draft').length > 0 && (
                  <p className="text-xs font-medium text-success flex items-center gap-1">
                    <FiCheckCircle className="w-3 h-3" />
                    Sincronizados
                  </p>
                )}
                {recentChecklists.map(checklist => {
                  const statusBadge = getStatusBadge(checklist.status)
                  return (
                    <Link
                      key={checklist.id}
                      href={`/checklist/${checklist.id}`}
                      className="card p-4 hover:shadow-theme-md transition-shadow block"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-main text-sm">
                          {checklist.template?.name}
                        </h4>
                        <span className={`badge-secondary text-xs ${statusBadge.class}`}>
                          {statusBadge.label}
                        </span>
                      </div>
                      {checklist.user?.full_name && (
                        <p className="text-[1rem] text-accent text-primary/80 mb-1">
                          {checklist.user.full_name}
                        </p>
                      )}
                      <p className="text-xs text-muted mb-1">
                        {checklist.store?.name}
                        {checklist.sector && ` - ${checklist.sector.name}`}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(checklist.created_at)}
                      </p>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      </PageContainer>
    </>
  )
}
