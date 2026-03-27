'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import {
  FiAlertCircle,
  FiCheckCircle,
  FiFilter,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiWifiOff,
  FiEye,
  FiAlertOctagon,
  FiActivity,
  FiLayers,
  FiTrash2,
} from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Select, PageContainer } from '@/components/ui'
import { getAuthCache, getUserCache, getActionPlansCache, getStoresCache, getAllUsersCache } from '@/lib/offlineCache'
import { logInfo, logError } from '@/lib/clientLogger'

type ActionPlan = {
  id: number
  title: string
  description: string | null
  status: string
  severity: string
  due_date: string | null
  recurrence_count: number
  created_at: string
  store: { name: string } | null
  assigned_user: { full_name: string } | null
  assigned_function: { name: string } | null
  assigned_function_id: number | null
  field: { name: string } | null
  template: { name: string } | null
  action_plan_stores?: { store: { name: string }; store_id: number }[]
}

type FilterStore = { id: number; name: string }
type FilterUser = { id: string; full_name: string }

/**
 * Página de listagem de planos de ação (`/admin/planos-de-acao`).
 * Exibe todos os planos com filtros por status, severidade, responsável e loja.
 * Suporta visualização offline via cache. Atualiza em tempo real via `useRealtimeActionPlans`.
 */
export default function PlanoDeAcaoPage() {
  const [loading, setLoading] = useState(true)
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([])
  const [isOffline, setIsOffline] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSeverity, setFilterSeverity] = useState('')
  const [filterStore, setFilterStore] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')

  // Filter options
  const [stores, setStores] = useState<FilterStore[]>([])
  const [users, setUsers] = useState<FilterUser[]>([])

  // Págination
  const [page, setPage] = useState(1)
  const perPage = 20

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { refreshKey } = useRealtimeRefresh(['action_plans'])

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (refreshKey > 0 && navigator.onLine) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const fetchData = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    let userId: string | null = null
    let isAdminUser = false
    let userFunctionId: number | null = null

    // Tenta verificar acesso online
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('is_admin, function_id')
          .eq('id', user.id)
          .single()
        isAdminUser = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
        userFunctionId = (profile as { function_id?: number } | null)?.function_id || null
      }
    } catch {
      logInfo('[PlanosDeAcao] Falha ao verificar online, tentando cache...')
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
        logInfo('[PlanosDeAcao] Falha ao buscar cache')
      }
    }

    if (!userId) {
      router.push(APP_CONFIG.routes.login)
      return
    }

    setIsAdmin(isAdminUser)

    try {
      setIsOffline(false)

      // Fetch plans: admin ve todos, nao-admin ve apenas os atribuidos a ele
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let plansQuery = (supabase as any)
        .from('action_plans')
        .select(`*, store:stores(name), assigned_function:functions(name), field:template_fields(name), template:checklist_templates(name), action_plan_stores(store_id, store:stores(name))`)
        .order('created_at', { ascending: false })

      if (!isAdminUser) {
        const orFilter = userFunctionId
          ? `assigned_to.eq.${userId},assigned_function_id.eq.${userFunctionId}`
          : `assigned_to.eq.${userId}`
        plansQuery = plansQuery.or(orFilter)
      }

      const [plansRes, storesRes, usersRes] = await Promise.all([
        plansQuery,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('stores')
          .select('id, name')
          .eq('is_active', true)
          .order('name'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('users')
          .select('id, full_name')
          .eq('is_active', true)
          .order('full_name'),
      ])

      if (plansRes.error) {
        logError('[PlanosDeAcao] Erro na query de planos', { error: plansRes.error.message })
      }

      if (plansRes.data) {
        // Buscar nomes dos responsaveis separadamente
        const assigneeIds = [...new Set(plansRes.data.map((p: { assigned_to: string }) => p.assigned_to).filter(Boolean))]
        let usersMap = new Map<string, string>()
        if (assigneeIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: assignees } = await (supabase as any)
            .from('users')
            .select('id, full_name')
            .in('id', assigneeIds)
          if (assignees) {
            usersMap = new Map(assignees.map((u: { id: string; full_name: string }) => [u.id, u.full_name]))
          }
        }
        // Montar assigned_user em cada plano (assigned_function ja vem do join)
        const plansWithUsers = plansRes.data.map((p: { assigned_to: string; assigned_function_id: number | null }) => ({
          ...p,
          assigned_user: usersMap.get(p.assigned_to) ? { full_name: usersMap.get(p.assigned_to) } : null,
        }))
        setActionPlans(plansWithUsers)
      }
      if (storesRes.data) {
        setStores(storesRes.data)
      }
      if (usersRes.data) {
        setUsers(usersRes.data)
      }
    } catch (error) {
      logError('[PlanosDeAcao] Erro ao buscar dados online', { error: error instanceof Error ? error.message : String(error) })
      // Fallback: carregar do cache offline
      try {
        const cachedPlans = await getActionPlansCache()
        if (cachedPlans.length > 0) {
          setActionPlans(cachedPlans.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            status: p.status,
            severity: p.severity,
            due_date: p.deadline,
            recurrence_count: p.reincidencia_count,
            created_at: p.created_at,
            store: p.store_name ? { name: p.store_name } : null,
            assigned_user: p.assignee_name ? { full_name: p.assignee_name } : null,
            assigned_function: null,
            assigned_function_id: null,
            field: p.field_name ? { name: p.field_name } : null,
            template: p.template_name ? { name: p.template_name } : null,
          })))
        }
        const cachedStores = await getStoresCache()
        if (cachedStores.length > 0) {
          setStores(cachedStores.map(s => ({ id: s.id, name: s.name })))
        }
        const cachedUsers = await getAllUsersCache()
        if (cachedUsers.length > 0) {
          setUsers(cachedUsers.map(u => ({ id: u.id, full_name: u.full_name })))
        }
      } catch (cacheErr) {
        logError('[PlanosDeAcao] Erro ao carregar cache', { error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr) })
      }
      setIsOffline(true)
    }

    setLoading(false)
  }

  // Summary counts
  const summary = useMemo(() => {
    const abertos = actionPlans.filter(p => p.status === 'aberto').length
    const emAndamento = actionPlans.filter(p => p.status === 'em_andamento').length
    const concluidos = actionPlans.filter(p => p.status === 'concluido').length
    const vencidos = actionPlans.filter(p => {
      if (p.status === 'concluido' || p.status === 'cancelado') return false
      if (!p.due_date) return false
      return new Date(p.due_date) < new Date()
    }).length
    return { abertos, emAndamento, concluidos, vencidos }
  }, [actionPlans])

  // Filtered plans
  const filteredPlans = useMemo(() => {
    return actionPlans.filter(p => {
      if (filterStatus && p.status !== filterStatus) return false
      if (filterSeverity && p.severity !== filterSeverity) return false
      if (filterStore) {
        // Check both legacy store field and action_plan_stores
        const matchesLegacy = p.store?.name === filterStore
        const matchesMulti = p.action_plan_stores?.some(aps => aps.store?.name === filterStore)
        if (!matchesLegacy && !matchesMulti) return false
      }
      if (filterAssignee) {
        const displayName = p.assigned_function?.name || p.assigned_user?.full_name
        if (displayName !== filterAssignee) return false
      }
      return true
    })
  }, [actionPlans, filterStatus, filterSeverity, filterStore, filterAssignee])

  // Págination
  const totalPages = Math.ceil(filteredPlans.length / perPage)
  const paginatedPlans = filteredPlans.slice((page - 1) * perPage, page * perPage)

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const allPageSelected = paginatedPlans.length > 0 && paginatedPlans.every(p => selectedIds.has(p.id))

  const toggleSelectAll = useCallback(() => {
    const pageIds = paginatedPlans.map(p => p.id)
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) {
        pageIds.forEach(id => next.delete(id))
      } else {
        pageIds.forEach(id => next.add(id))
      }
      return next
    })
  }, [paginatedPlans, allPageSelected])

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Tem certeza que deseja EXCLUIR ${selectedIds.size} plano(s) de acao? Esta ação é irreversível.`)) return

    setDeleting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    let errors = 0

    for (const planId of selectedIds) {
      try {
        const { error: e1 } = await sb.from('action_plan_updates').delete().eq('action_plan_id', planId)
        if (e1) throw e1
        const { error: e2 } = await sb.from('action_plan_stores').delete().eq('action_plan_id', planId)
        if (e2) throw e2
        const { error: e3 } = await sb.from('action_plan_evidence').delete().eq('action_plan_id', planId)
        if (e3) throw e3
        const { error: e4 } = await sb.from('action_plans').delete().eq('id', planId)
        if (e4) throw e4
      } catch (err) {
        logError(`[PlanosDeAcao] Erro ao excluir plano #${planId}`, { error: err instanceof Error ? err.message : String(err) })
        errors++
      }
    }

    const total = selectedIds.size
    setSelectedIds(new Set())
    setDeleting(false)

    if (errors > 0) {
      alert(`${total - errors} plano(s) excluido(s) com sucesso. ${errors} falharam.`)
    }

    fetchData()
  }

  const handleDeleteAll = async () => {
    if (actionPlans.length === 0) return
    if (!confirm(`Tem certeza que deseja EXCLUIR TODOS os ${actionPlans.length} plano(s) de acao? Esta ação é irreversível.`)) return
    if (!confirm('Confirme novamente: TODOS os planos de ação e seus dados relacionados serão excluídos permanentemente.')) return

    setDeleting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any
    try {
      await sb.from('action_plan_updates').delete().neq('id', 0)
      await sb.from('action_plan_stores').delete().neq('id', 0)
      await sb.from('action_plan_evidence').delete().neq('id', 0)
      await sb.from('action_plans').delete().neq('id', 0)
    } catch (err) {
      logError('[PlanosDeAcao] Erro ao excluir todos', { error: err instanceof Error ? err.message : String(err) })
      alert('Erro ao excluir planos. Verifique o console.')
    }

    setSelectedIds(new Set())
    setDeleting(false)
    fetchData()
  }

  // Helpers
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; cls: string }> = {
      aberto: { label: 'Aberto', cls: 'bg-warning/20 text-warning' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-info/20 text-info' },
      concluido: { label: 'Concluído', cls: 'bg-success/20 text-success' },
      vencido: { label: 'Vencido', cls: 'bg-error/20 text-error' },
      cancelado: { label: 'Cancelado', cls: 'bg-surface-hover text-muted' },
    }
    return badges[status] || { label: status, cls: 'bg-surface-hover text-muted' }
  }

  const getSeverityBadge = (severity: string) => {
    const badges: Record<string, { label: string; cls: string }> = {
      baixa: { label: 'Baixa', cls: 'bg-success/20 text-success' },
      media: { label: 'Média', cls: 'bg-warning/20 text-warning' },
      alta: { label: 'Alta', cls: 'bg-orange-500/20 text-orange-500' },
      critica: { label: 'Crítica', cls: 'bg-error/20 text-error' },
    }
    return badges[severity] || { label: severity, cls: 'bg-surface-hover text-muted' }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  }

  const isOverdue = (plan: ActionPlan) => {
    if (plan.status === 'concluido' || plan.status === 'cancelado') return false
    if (!plan.due_date) return false
    return new Date(plan.due_date) < new Date()
  }

  if (loading) {
    return <LoadingPage />
  }

  return (
      <PageContainer>
        {/* Offline Warning */}
        {isOffline && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiWifiOff className="w-5 h-5 text-warning" />
            <p className="text-warning text-sm">
              Você está offline. Exibindo dados salvos localmente (somente leitura).
            </p>
          </div>
        )}

        {/* Header with New Plan button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-main">
            {isAdmin ? 'Planos de Ação' : 'Meus Planos de Ação'}
          </h2>
          {isAdmin && (
            <>
              <Link
                href={APP_CONFIG.routes.adminActionPlanPresets}
                className="btn-secondary flex items-center gap-2"
              >
                <FiLayers className="w-4 h-4" />
                <span className="hidden sm:inline">Modelos</span>
              </Link>
              <Link
                href={APP_CONFIG.routes.adminActionPlanNew}
                className="btn-primary flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo Plano</span>
              </Link>
            </>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <FiAlertCircle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-main">{summary.abertos}</p>
                <p className="text-xs text-muted">Abertos</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center">
                <FiActivity className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-main">{summary.emAndamento}</p>
                <p className="text-xs text-muted">Em Andamento</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-error/20 flex items-center justify-center">
                <FiAlertOctagon className="w-5 h-5 text-error" />
              </div>
              <div>
                <p className="text-2xl font-bold text-main">{summary.vencidos}</p>
                <p className="text-xs text-muted">Vencidos</p>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center">
                <FiCheckCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-main">{summary.concluidos}</p>
                <p className="text-xs text-muted">Concluídos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FiFilter className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-main">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              value={filterStatus}
              onChange={(v) => { setFilterStatus(v); setPage(1) }}
              placeholder="Todos os status"
              options={[
                { value: 'aberto',       label: 'Aberto' },
                { value: 'em_andamento', label: 'Em Andamento' },
                { value: 'concluido',    label: 'Concluído' },
                { value: 'vencido',      label: 'Vencido' },
                { value: 'cancelado',    label: 'Cancelado' },
              ]}
            />

            <Select
              value={filterSeverity}
              onChange={(v) => { setFilterSeverity(v); setPage(1) }}
              placeholder="Todas as severidades"
              options={[
                { value: 'baixa',  label: 'Baixa' },
                { value: 'media',  label: 'Média' },
                { value: 'alta',   label: 'Alta' },
                { value: 'critica', label: 'Crítica' },
              ]}
            />

            <Select
              value={filterStore}
              onChange={(v) => { setFilterStore(v); setPage(1) }}
              placeholder="Todas as lojas"
              options={stores.map(s => ({ value: s.name, label: s.name }))}
            />

            <Select
              value={filterAssignee}
              onChange={(v) => { setFilterAssignee(v); setPage(1) }}
              placeholder="Todos os responsáveis"
              options={users.map(u => ({ value: u.full_name, label: u.full_name }))}
            />
          </div>
        </div>

        {/* Stats + bulk actions */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted">
            {filteredPlans.length} plano(s) de acao encontrado(s)
          </p>
          <div className="flex items-center gap-2">
            {isAdmin && selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-error/20 text-error hover:bg-error/30 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiTrash2 className="w-4 h-4" />
                )}
                {deleting ? 'Excluindo...' : `Excluir ${selectedIds.size} selecionado(s)`}
              </button>
            )}
            {isAdmin && actionPlans.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-error/20 text-error hover:bg-error/30 transition-colors disabled:opacity-50"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiTrash2 className="w-4 h-4" />
                )}
                Excluir Todos ({actionPlans.length})
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-hover">
                <tr>
                  {isAdmin && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-default bg-surface text-primary focus:ring-primary cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Título</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Severidade</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Responsável</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Prazo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted">Reincidência</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {paginatedPlans.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-muted">
                      Nenhum plano de ação encontrado
                    </td>
                  </tr>
                ) : (
                  paginatedPlans.map(plan => {
                    const statusBadge = getStatusBadge(plan.status)
                    const severityBadge = getSeverityBadge(plan.severity)
                    const overdue = isOverdue(plan)

                    return (
                      <tr key={plan.id} className={`hover:bg-surface-hover/50 ${selectedIds.has(plan.id) ? 'bg-primary/5' : ''}`}>
                        {isAdmin && (
                          <td className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(plan.id)}
                              onChange={() => toggleSelect(plan.id)}
                              className="w-4 h-4 rounded border-default bg-surface text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-main text-sm">{plan.title}</p>
                            {plan.template && (
                              <p className="text-xs text-muted">{plan.template.name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {plan.action_plan_stores && plan.action_plan_stores.length > 0 ? (
                            <div className="text-sm text-secondary">
                              {plan.action_plan_stores.map((aps, idx) => (
                                <span key={idx}>
                                  {aps.store?.name}{idx < plan.action_plan_stores!.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-secondary">{plan.store?.name || '-'}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${severityBadge.cls}`}>
                            {severityBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-main">
                            {plan.assigned_function?.name || plan.assigned_user?.full_name || '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className={`text-sm ${overdue ? 'text-error font-medium' : 'text-muted'}`}>
                            {formatDate(plan.due_date)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {plan.recurrence_count > 0 ? (
                            <span className="inline-block px-2 py-1 rounded-lg text-xs font-medium bg-error/20 text-error">
                              {plan.recurrence_count}x
                            </span>
                          ) : (
                            <span className="text-sm text-muted">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/planos-de-acao/${plan.id}`}
                            className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                            title="Ver detalhes"
                          >
                            <FiEye className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Págination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
              <p className="text-sm text-muted">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </PageContainer>
  )
}
