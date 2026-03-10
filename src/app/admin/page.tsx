'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import {
  getAuthCache,
  getUserCache,
  getAllUsersCache,
  getTemplatesCache,
  getStoresCache,
  getSectorsCache,
  getFunctionsCache,
} from '@/lib/offlineCache'
import {
  FiUsers,
  FiClipboard,
  FiBarChart2,
  FiSettings,
  FiCheckCircle,
  FiAlertTriangle,
  FiGrid,
  FiImage,
  FiHome,
  FiSliders,
  FiBookmark,
  FiFileText,
  FiZap,
  FiUserPlus,
  FiPlusCircle,
  FiArrowRight,
  FiBell,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { useDebouncedCallback } from 'use-debounce'

type Stats = {
  totalUsers: number
  totalTemplates: number
  totalStores: number
  totalSectors: number
  totalFunctions: number
  totalChecklists: number
  checklistsToday: number
  pendingValidations: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type PreviewData = {
  recentUsers: any[]
  recentTemplates: any[]
  recentStores: any[]
  recentSectors: any[]
  recentFunctions: any[]
  recentChecklists: any[]
  recentValidations: any[]
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTemplates: 0,
    totalStores: 0,
    totalSectors: 0,
    totalFunctions: 0,
    totalChecklists: 0,
    checklistsToday: 0,
    pendingValidations: 0,
  })
  const [preview, setPreview] = useState<PreviewData>({
    recentUsers: [],
    recentTemplates: [],
    recentStores: [],
    recentSectors: [],
    recentFunctions: [],
    recentChecklists: [],
    recentValidations: [],
  })
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('Admin User')
  const [ignoreTimeRestrictions, setIgnoreTimeRestrictions] = useState(false)
  const [togglingTime, setTogglingTime] = useState(false)
  const [bypassStoreIds, setBypassStoreIds] = useState<number[] | 'all'>('all')
  const [allStores, setAllStores] = useState<{id: number; name: string}[]>([])
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default')
  const [notificationBannerMounted, setNotificationBannerMounted] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const fetchStats = async () => {
      // Se Supabase não está configurado, apenas mostra a página
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }

      let userId: string | null = null
      let isAdmin = false

      // Tenta online primeiro
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          userId = user.id
          const { data: profile } = await supabase
            .from('users')
            .select('is_admin, full_name')
            .eq('id', user.id)
            .single()
          isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
          if (profile && 'full_name' in profile && (profile as { full_name: string }).full_name) {
            setUserName((profile as { full_name: string }).full_name)
          }
        }
      } catch {
        console.log('[Admin] Falha ao buscar online, tentando cache...')
      }

      // Se não conseguiu online, tenta cache
      if (!userId) {
        try {
          const cachedAuth = await getAuthCache()
          if (cachedAuth) {
            userId = cachedAuth.userId
            const cachedUser = await getUserCache(cachedAuth.userId)
            isAdmin = cachedUser?.is_admin || false
            if (cachedUser?.full_name) setUserName(cachedUser.full_name)
          }
        } catch {
          console.log('[Admin] Falha ao buscar cache')
        }
      }

      if (!userId) {
        router.push(APP_CONFIG.routes.login)
        return
      }

      if (!isAdmin) {
        router.push(APP_CONFIG.routes.dashboard)
        return
      }

      // Tenta buscar stats online
      try {
        const [
          usersRes, templatesRes, storesRes, sectorsRes, functionsRes, checklistsRes, validationsRes,
          recentUsersRes, recentTemplatesRes, recentStoresRes, recentSectorsRes, recentFunctionsRes, recentChecklistsRes, recentValidationsRes,
        ] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('checklist_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('sectors').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('functions').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('checklists').select('id', { count: 'exact', head: true }),
          supabase.from('cross_validations').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
          // Preview data for cards
          supabase.from('users').select('id, full_name, email, is_active, created_at').order('created_at', { ascending: false }).limit(3),
          supabase.from('checklist_templates').select('id, name, category, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
          supabase.from('stores').select('id, name, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
          supabase.from('sectors').select('id, name, color, is_active, store:stores(name)').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
          supabase.from('functions').select('id, name, color, is_active').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
          supabase.from('checklists').select('id, status, created_at, template:checklist_templates(name), store:stores(name), user:users(full_name)').order('created_at', { ascending: false }).limit(3),
          supabase.from('cross_validations').select('id, status, numero_nota, created_at, store:stores(name)').eq('status', 'pendente').order('created_at', { ascending: false }).limit(3),
        ])

        // Checklists today
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count: checklistsTodayCount } = await supabase
          .from('checklists')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', today.toISOString())

        setStats({
          totalUsers: usersRes.count || 0,
          totalTemplates: templatesRes.count || 0,
          totalStores: storesRes.count || 0,
          totalSectors: sectorsRes.count || 0,
          totalFunctions: functionsRes.count || 0,
          totalChecklists: checklistsRes.count || 0,
          checklistsToday: checklistsTodayCount || 0,
          pendingValidations: validationsRes.count || 0,
        })

        setPreview({
          recentUsers: recentUsersRes.data || [],
          recentTemplates: recentTemplatesRes.data || [],
          recentStores: recentStoresRes.data || [],
          recentSectors: recentSectorsRes.data || [],
          recentFunctions: recentFunctionsRes.data || [],
          recentChecklists: recentChecklistsRes.data || [],
          recentValidations: recentValidationsRes.data || [],
        })
      } catch (err) {
        console.error('[Admin] Erro ao buscar estatísticas online:', err)

        // Fallback para cache offline
        try {
          const [cachedUsers, cachedTemplates, cachedStores, cachedSectors, cachedFunctions] = await Promise.all([
            getAllUsersCache(),
            getTemplatesCache(),
            getStoresCache(),
            getSectorsCache(),
            getFunctionsCache(),
          ])

          setStats({
            totalUsers: cachedUsers.length,
            totalTemplates: cachedTemplates.filter(t => t.is_active).length,
            totalStores: cachedStores.filter(s => s.is_active).length,
            totalSectors: cachedSectors.filter(s => s.is_active).length,
            totalFunctions: cachedFunctions.filter(f => f.is_active).length,
            totalChecklists: 0,
            checklistsToday: 0,
            pendingValidations: 0,
          })
          console.log('[Admin] Stats carregados do cache offline')
        } catch (cacheErr) {
          console.error('[Admin] Erro ao buscar cache:', cacheErr)
        }
      }

      // Fetch time restriction settings + all stores
      try {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token || ''

        const [settingsRes, storesListRes] = await Promise.all([
          fetch('/api/settings?keys=ignore_time_restrictions,ignore_time_restrictions_stores', {
            headers: { 'x-supabase-auth': token },
          }),
          (supabase as any).from('stores').select('id, name').eq('is_active', true).order('name'),
        ])

        if (settingsRes.ok) {
          const settings = await settingsRes.json() as { key: string; value: string }[]
          const toggleVal = settings.find(s => s.key === 'ignore_time_restrictions')?.value
          const storesVal = settings.find(s => s.key === 'ignore_time_restrictions_stores')?.value
          setIgnoreTimeRestrictions(toggleVal === 'true')
          if (storesVal && storesVal !== 'all') {
            try { setBypassStoreIds(JSON.parse(storesVal)) } catch { setBypassStoreIds('all') }
          } else {
            setBypassStoreIds('all')
          }
        }

        if (storesListRes.data) {
          setAllStores(storesListRes.data)
        }
      } catch { /* ignore */ }

      setLoading(false)
    }

    fetchStats()
  }, [supabase, router])

  // Permissao de notificacoes do sistema (para o banner)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
    }
    setNotificationBannerMounted(true)
  }, [])

  const handleToggleTimeRestrictions = async () => {
    setTogglingTime(true)
    try {
      const newValue = !ignoreTimeRestrictions
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || ''
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-supabase-auth': token,
        },
        body: JSON.stringify({ key: 'ignore_time_restrictions', value: String(newValue) }),
      })
      if (res.ok) {
        setIgnoreTimeRestrictions(newValue)
      }
    } catch (err) {
      console.error('[Admin] Erro ao alterar configuracao de tempo:', err)
    }
    setTogglingTime(false)
  }

  // Debounced save for per-store bypass selection
  const saveBypassStores = useDebouncedCallback(async (mode: number[] | 'all') => {
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token || ''
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-supabase-auth': token },
        body: JSON.stringify({
          key: 'ignore_time_restrictions_stores',
          value: mode === 'all' ? 'all' : JSON.stringify(mode),
        }),
      })
    } catch (err) {
      console.error('[Admin] Erro ao salvar lojas bypass:', err)
    }
  }, 500)

  const handleBypassStoresChange = (mode: number[] | 'all') => {
    setBypassStoreIds(mode)
    saveBypassStores(mode)
  }

  const handleSignOut = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' })
      }
    } catch { /* ignore */ }
    if (supabase) {
      await supabase.auth.signOut()
    }
    router.push(APP_CONFIG.routes.login)
  }

  if (loading) {
    return <LoadingPage />
  }

  const categoryLabels: Record<string, string> = {
    recebimento: 'Recebimento',
    limpeza: 'Limpeza',
    abertura: 'Abertura',
    fechamento: 'Fechamento',
    outros: 'Outros',
  }

  const statusLabels: Record<string, string> = {
    rascunho: 'Rascunho',
    em_andamento: 'Andamento',
    concluido: 'Concluido',
    validado: 'Validado',
    incompleto: 'Incompleto',
    pendente: 'Pendente',
    sucesso: 'Sucesso',
    falhou: 'Falhou',
  }

  const menuItems: {
    title: string
    description: string
    icon: IconType
    href: string
    stat: number | string
    badgeLabel: string
    previewKey?: keyof PreviewData
  }[] = [
    {
      title: 'Usuarios',
      description: 'Gerenciar usuarios e permissoes',
      icon: FiUsers,
      href: APP_CONFIG.routes.adminUsers,
      stat: stats.totalUsers,
      badgeLabel: 'Users',
      previewKey: 'recentUsers',
    },
    {
      title: 'Checklists',
      description: 'Criar e editar modelos',
      icon: FiFileText,
      href: APP_CONFIG.routes.adminTemplates,
      stat: stats.totalTemplates,
      badgeLabel: 'Templates',
      previewKey: 'recentTemplates',
    },
    {
      title: 'Lojas',
      description: 'Gerenciar unidades',
      icon: FiHome,
      href: APP_CONFIG.routes.adminStores,
      stat: stats.totalStores,
      badgeLabel: 'Units',
      previewKey: 'recentStores',
    },
    {
      title: 'Setores',
      description: 'Cozinha, Estoque, Salao, etc.',
      icon: FiGrid,
      href: APP_CONFIG.routes.adminSectors,
      stat: stats.totalSectors,
      badgeLabel: 'Items',
      previewKey: 'recentSectors',
    },
    {
      title: 'Funcoes',
      description: 'Cozinheiro, Zelador, Garcom, etc.',
      icon: FiClipboard,
      href: APP_CONFIG.routes.adminFunctions,
      stat: stats.totalFunctions,
      badgeLabel: 'Roles',
      previewKey: 'recentFunctions',
    },
    {
      title: 'Validacoes',
      description: 'Estoquista vs Aprendiz',
      icon: FiSliders,
      href: APP_CONFIG.routes.adminValidations,
      stat: stats.pendingValidations,
      badgeLabel: 'Pending',
      previewKey: 'recentValidations',
    },
    {
      title: 'Respostas',
      description: 'Gerenciar e excluir',
      icon: FiBookmark,
      href: APP_CONFIG.routes.adminChecklists,
      stat: stats.totalChecklists,
      badgeLabel: 'New',
      previewKey: 'recentChecklists',
    },
    {
      title: 'Galeria',
      description: 'Fotos e anexos',
      icon: FiImage,
      href: APP_CONFIG.routes.adminGallery,
      stat: 0,
      badgeLabel: 'Files',
    },
    {
      title: 'Planos de Acao',
      description: 'Nao conformidades e acoes',
      icon: FiAlertTriangle,
      href: APP_CONFIG.routes.adminActionPlans,
      stat: 0,
      badgeLabel: 'Planos',
    },
    {
      title: 'Relatorios',
      description: 'Estatisticas e analises',
      icon: FiBarChart2,
      href: APP_CONFIG.routes.adminReports,
      stat: stats.totalChecklists,
      badgeLabel: 'Analytics',
    },
    {
      title: 'Configuracoes',
      description: 'Email templates e ajustes',
      icon: FiSettings,
      href: APP_CONFIG.routes.adminSettings,
      stat: 0,
      badgeLabel: 'Config',
    },
  ]

  const quickActions = [
    {
      title: 'Novo Usuario',
      description: 'Invite team member',
      icon: FiUserPlus,
      href: APP_CONFIG.routes.adminUsersNew,
    },
    {
      title: 'Novo Template',
      description: 'Create structure',
      icon: FiPlusCircle,
      href: APP_CONFIG.routes.adminTemplatesNew,
    },
    {
      title: 'Ver Relatorios',
      description: 'Check analytics',
      icon: FiBarChart2,
      href: APP_CONFIG.routes.adminReports,
    },
  ]

  const statCards = [
    { label: 'CHECKLISTS HOJE', value: stats.checklistsToday, icon: FiCheckCircle, color: 'bg-primary/10 text-primary', href: APP_CONFIG.routes.dashboard },
    { label: 'PENDENTES', value: stats.pendingValidations, icon: FiAlertTriangle, color: 'bg-warning/10 text-warning', href: APP_CONFIG.routes.adminChecklists },
    { label: 'TOTAL', value: stats.totalChecklists, icon: FiFileText, color: 'bg-info/10 text-info', href: APP_CONFIG.routes.adminChecklists },
    { label: 'ATIVOS', value: stats.totalUsers, icon: FiUsers, color: 'bg-accent/10 text-accent', href: APP_CONFIG.routes.adminUsers },
  ]

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Painel Admin"
        subtitle={`${APP_CONFIG.name} v${APP_CONFIG.version}`}
        icon={FiSettings}
        showSearch
        showNotifications
        notificationCount={stats.pendingValidations}
        userName={userName}
        userRole="Super Admin"
        isAdmin={true}
        onSignOut={handleSignOut}
      />

      {/* Aviso para ativar notificacoes do sistema (PWA) */}
      {notificationBannerMounted && typeof window !== 'undefined' && 'Notification' in window && notificationPermission === 'default' && (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="card p-4 bg-primary/10 border border-primary/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <FiBell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-main text-sm">Receba avisos no celular</p>
                <p className="text-xs text-muted">Planos de acao, vencimentos e alertas como notificacao do sistema.</p>
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
              Ativar notificacoes
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Left Column - Main Content */}
          <main className="flex-1 min-w-0">
            {/* Mobile: Modo Teste */}
            <div className="lg:hidden mb-4">
              <div className="card p-4">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-3 min-w-0">
                    <FiSettings className="w-4 h-4 text-muted shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-main leading-tight">Ignorar horarios</p>
                      <p className="text-xs text-muted leading-tight">Desativa restricoes de horario</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleTimeRestrictions}
                    disabled={togglingTime}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      ignoreTimeRestrictions ? 'bg-primary' : 'bg-surface-hover border border-subtle'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      ignoreTimeRestrictions ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </label>
                {ignoreTimeRestrictions && (
                  <div className="mt-3 pt-3 border-t border-subtle space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleBypassStoresChange('all')}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          bypassStoreIds === 'all'
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover text-muted hover:text-main'
                        }`}
                      >
                        Todas as lojas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (bypassStoreIds === 'all') handleBypassStoresChange([])
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          bypassStoreIds !== 'all'
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover text-muted hover:text-main'
                        }`}
                      >
                        Lojas especificas
                      </button>
                    </div>
                    {bypassStoreIds !== 'all' && (
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {allStores.map(store => {
                          const checked = Array.isArray(bypassStoreIds) && bypassStoreIds.includes(store.id)
                          return (
                            <label key={store.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const cur = Array.isArray(bypassStoreIds) ? bypassStoreIds : []
                                  handleBypassStoresChange(checked ? cur.filter(id => id !== store.id) : [...cur, store.id])
                                }}
                                className="w-3.5 h-3.5 rounded border-subtle accent-primary"
                              />
                              <span className="text-xs text-main">{store.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                    <div className={`px-2 py-1 rounded-lg ${
                      bypassStoreIds !== 'all' && Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                        ? 'bg-muted/10' : 'bg-warning/10'
                    }`}>
                      <p className={`text-xs font-medium ${
                        bypassStoreIds !== 'all' && Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                          ? 'text-muted' : 'text-warning'
                      }`}>
                        {bypassStoreIds === 'all'
                          ? 'Restricoes de horario desativadas para todas as lojas'
                          : Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                            ? 'Nenhuma loja selecionada'
                            : `Restricoes desativadas para ${(bypassStoreIds as number[]).length} loja(s)`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statCards.map((stat) => {
                const StatIcon = stat.icon
                return (
                  <Link href={stat.href} key={stat.label} className="card card-hover p-4 sm:p-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${stat.color.split(' ')[0]}`}>
                        <StatIcon className={`w-6 h-6 ${stat.color.split(' ')[1]}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-muted uppercase tracking-wider leading-tight truncate">{stat.label}</p>
                        <p className="text-2xl sm:text-3xl font-bold text-main leading-tight">{stat.value}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Gerenciamento Section */}
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-main">Gerenciamento</h2>
                <p className="text-sm text-muted mt-0.5">Overview of system modules and configurations</p>
              </div>
              <Link href={APP_CONFIG.routes.dashboard} className="text-sm text-primary font-medium hover:text-primary/80 transition-colors flex items-center gap-1 shrink-0">
                View All <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Management Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menuItems.map((item) => {
                const Icon = item.icon
                const rows = item.previewKey ? preview[item.previewKey] : []
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group card card-hover p-5 flex flex-col min-h-[190px]"
                  >
                    {/* Top: Icon + Badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-surface-hover border border-subtle flex items-center justify-center group-hover:border-primary/30 transition-colors">
                        <Icon className="w-6 h-6 text-main group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-accent bg-accent/10 px-2.5 py-1 rounded-full">
                        {typeof item.stat === 'number' ? `${item.stat} ${item.badgeLabel}` : item.badgeLabel}
                      </span>
                    </div>

                    {/* Middle: Title + Description */}
                    <div>
                      <h3 className="text-base font-semibold text-main group-hover:text-primary transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted mt-0.5">{item.description}</p>
                    </div>

                    {/* Mini-table preview */}
                    {rows.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-subtle space-y-2">
                        {item.previewKey === 'recentUsers' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            <span className="text-main font-medium truncate flex-1">{r.full_name || '-'}</span>
                            <span className="text-muted truncate max-w-[120px]">{r.email}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentTemplates' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <span className="text-main font-medium truncate flex-1">{r.name}</span>
                            <span className="text-muted text-[10px] bg-surface-hover px-1.5 py-0.5 rounded">{categoryLabels[r.category] || 'Outros'}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentStores' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                            <span className="text-main font-medium truncate flex-1">{r.name}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentSectors' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded shrink-0" style={{ backgroundColor: r.color || '#94a3b8' }} />
                            <span className="text-main font-medium truncate flex-1">{r.name}</span>
                            <span className="text-muted truncate max-w-[80px]">{r.store?.name || ''}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentFunctions' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color || '#94a3b8' }} />
                            <span className="text-main font-medium truncate flex-1">{r.name}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentValidations' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <span className="text-main font-medium truncate flex-1">Nota {r.numero_nota}</span>
                            <span className="text-muted truncate max-w-[80px]">{r.store?.name || ''}</span>
                            <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">{statusLabels[r.status] || r.status}</span>
                          </div>
                        ))}
                        {item.previewKey === 'recentChecklists' && rows.map((r: any) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <span className="text-main font-medium truncate flex-1">{r.template?.name || '-'}</span>
                            <span className="text-muted truncate max-w-[60px]">{r.store?.name || ''}</span>
                            <span className="text-[10px] text-muted bg-surface-hover px-1.5 py-0.5 rounded">{statusLabels[r.status] || r.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </main>

          {/* Right Column - Sidebar */}
          <aside className="w-72 xl:w-80 hidden lg:flex flex-col gap-5 shrink-0">
            {/* Quick Actions */}
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-main mb-4">
                <FiZap className="w-5 h-5 text-warning" />
                Acoes Rapidas
              </h3>
              <div className="space-y-1">
                {quickActions.map((action) => {
                  const ActionIcon = action.icon
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-hover transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-hover border border-subtle flex items-center justify-center group-hover:border-primary/30 transition-colors shrink-0">
                        <ActionIcon className="w-5 h-5 text-main group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-main leading-tight">{action.title}</p>
                        <p className="text-xs text-muted leading-tight mt-0.5">{action.description}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Modo Teste — Desktop */}
            <div className="card p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-main mb-3">
                <FiSettings className="w-4 h-4 text-muted" />
                Modo Teste
              </h3>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-main leading-tight">Ignorar horarios</p>
                  <p className="text-xs text-muted leading-tight mt-0.5">Desativa restricoes de horario dos templates</p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleTimeRestrictions}
                  disabled={togglingTime}
                  className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                    ignoreTimeRestrictions ? 'bg-primary' : 'bg-surface-hover border border-subtle'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    ignoreTimeRestrictions ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </label>
              {ignoreTimeRestrictions && (
                <div className="mt-3 pt-3 border-t border-subtle space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleBypassStoresChange('all')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        bypassStoreIds === 'all'
                          ? 'bg-primary text-white'
                          : 'bg-surface-hover text-muted hover:text-main'
                      }`}
                    >
                      Todas as lojas
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (bypassStoreIds === 'all') handleBypassStoresChange([])
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        bypassStoreIds !== 'all'
                          ? 'bg-primary text-white'
                          : 'bg-surface-hover text-muted hover:text-main'
                      }`}
                    >
                      Lojas especificas
                    </button>
                  </div>
                  {bypassStoreIds !== 'all' && (
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {allStores.map(store => {
                        const checked = Array.isArray(bypassStoreIds) && bypassStoreIds.includes(store.id)
                        return (
                          <label key={store.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const cur = Array.isArray(bypassStoreIds) ? bypassStoreIds : []
                                handleBypassStoresChange(checked ? cur.filter(id => id !== store.id) : [...cur, store.id])
                              }}
                              className="w-3.5 h-3.5 rounded border-subtle accent-primary"
                            />
                            <span className="text-xs text-main">{store.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  <div className={`px-2 py-1 rounded-lg ${
                    bypassStoreIds !== 'all' && Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                      ? 'bg-muted/10' : 'bg-warning/10'
                  }`}>
                    <p className={`text-xs font-medium ${
                      bypassStoreIds !== 'all' && Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                        ? 'text-muted' : 'text-warning'
                    }`}>
                      {bypassStoreIds === 'all'
                        ? 'Restricoes de horario desativadas para todas as lojas'
                        : Array.isArray(bypassStoreIds) && bypassStoreIds.length === 0
                          ? 'Nenhuma loja selecionada'
                          : `Restricoes desativadas para ${(bypassStoreIds as number[]).length} loja(s)`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* System Status */}
            <div className="rounded-2xl p-5 bg-[#1E293B] dark:bg-[#0F172A] text-white">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/70 mb-3">System Status</h4>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-white">All systems operational</span>
              </div>
              <p className="text-xs text-white/50">Last check: 2 mins ago</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
