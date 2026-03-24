'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import {
  FiBarChart2, FiClipboard, FiCheckCircle, FiClock, FiAlertCircle,
  FiEye, FiDownload, FiChevronDown, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, PageContainer } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { exportResponsesToCSV, exportResponsesToTXT, type UserChecklistExport } from '@/lib/exportUtils'

type MyChecklist = {
  id: number
  status: string
  created_at: string
  completed_at: string | null
  store_name: string
  template_name: string
}

/**
 * Página de relatórios do operador (`/relatorios`).
 * Exibe o histórico de checklists preenchidos pelo próprio usuário com
 * filtro por período (7d, 30d, 90d) e métricas de conformidade pessoal.
 */
export default function MeusRelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [checklists, setChecklists] = useState<MyChecklist[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'responses'>('overview')
  const [responsePage, setResponsePage] = useState(1)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const responsePerPage = 20
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { refreshKey } = useRealtimeRefresh(['checklists', 'action_plans'])

  useEffect(() => { fetchData() }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refreshKey > 0 && navigator.onLine) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])
  useEffect(() => { setExportMenuOpen(false) }, [activeTab])

  const fetchData = async () => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return }

    let userId: string | null = null
    let fetchedName = ''
    let fetchedEmail = ''

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        fetchedEmail = user.email || ''
        const { data: profile } = await supabase
          .from('users').select('full_name, email').eq('id', user.id).single()
        if (profile) {
          fetchedName = (profile as { full_name: string }).full_name || ''
          fetchedEmail = (profile as { email?: string }).email || fetchedEmail
        }
      }
    } catch { /* offline */ }

    if (!userId) {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          userId = cachedAuth.userId
          const cachedUser = await getUserCache(cachedAuth.userId)
          if (cachedUser) {
            fetchedName = cachedUser.full_name || ''
            fetchedEmail = cachedUser.email || ''
          }
        }
      } catch { /* no cache */ }
    }

    if (!userId) { router.push(APP_CONFIG.routes.login); return }
    setUserName(fetchedName)
    setUserEmail(fetchedEmail)

    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('checklists')
        .select('id, status, created_at, completed_at, store:stores(name), template:checklist_templates(name)')
        .eq('created_by', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })

      if (data) {
        setChecklists(data.map((c: {
          id: number; status: string; created_at: string; completed_at: string | null;
          store: { name: string } | null; template: { name: string } | null;
        }) => ({
          id: c.id, status: c.status, created_at: c.created_at, completed_at: c.completed_at,
          store_name: c.store?.name || '', template_name: c.template?.name || '',
        })))
      }
    } catch (error) {
      console.error('[MeusRelatorios] Erro ao buscar dados:', error)
    }
    setLoading(false)
  }

  const summary = useMemo(() => {
    const total = checklists.length
    const completed = checklists.filter(c => c.status === 'concluido' || c.status === 'validado').length
    const inProgress = checklists.filter(c => c.status === 'em_andamento').length
    const incomplete = checklists.filter(c => c.status === 'incompleto' || c.status === 'rascunho').length
    return { total, completed, inProgress, incomplete }
  }, [checklists])

  const responseTotalPages = Math.ceil(checklists.length / responsePerPage)
  const paginatedChecklists = checklists.slice((responsePage - 1) * responsePerPage, responsePage * responsePerPage)

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  const badge = (status: string) => {
    const m: Record<string, { label: string; cls: string }> = {
      validado: { label: 'Validado', cls: 'bg-success/20 text-success' },
      concluido: { label: 'Concluido', cls: 'bg-primary/20 text-primary' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-warning/20 text-warning' },
      incompleto: { label: 'Incompleto', cls: 'bg-error/20 text-error' },
      rascunho: { label: 'Rascunho', cls: 'bg-surface-hover text-muted' },
    }
    return m[status] || { label: status, cls: 'bg-surface-hover text-muted' }
  }

  const handleExport = (format: 'csv' | 'txt') => {
    setExportMenuOpen(false)
    setExporting(true)
    try {
      const ts = new Date().toISOString().split('T')[0]
      const items: UserChecklistExport[] = checklists.map(c => ({
        id: c.id, status: c.status, created_at: c.created_at, completed_at: c.completed_at,
        user_name: userName, user_email: userEmail, store_name: c.store_name, template_name: c.template_name,
      }))
      if (format === 'csv') exportResponsesToCSV(items, `meus_checklists_${ts}.csv`)
      else exportResponsesToTXT(items, `meus_checklists_${ts}.txt`)
    } catch (err) {
      console.error('[MeusRelatorios] Erro ao exportar:', err)
    } finally {
      setExporting(false)
    }
  }

  const exportDropdown = (
    <div className="relative">
      <button
        onClick={() => setExportMenuOpen(!exportMenuOpen)}
        disabled={exporting}
        className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
      >
        <FiDownload className="text-base" />
        {exporting ? 'Exportando...' : 'Exportar'}
        <FiChevronDown className="text-xs" />
      </button>
      {exportMenuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[120px]">
          <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-t-lg">CSV</button>
          <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-b-lg">TXT</button>
        </div>
      )}
    </div>
  )

  const checklistRow = (c: MyChecklist, showCompleted: boolean) => {
    const b = badge(c.status)
    return (
      <tr key={c.id} className="hover:bg-surface-hover/50">
        <td className="px-4 py-3"><p className="font-medium text-main text-sm">{c.template_name}</p></td>
        <td className="px-4 py-3"><p className="text-sm text-secondary">{c.store_name}</p></td>
        <td className="px-4 py-3">
          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${b.cls}`}>{b.label}</span>
        </td>
        <td className="px-4 py-3"><p className="text-sm text-muted">{fmt(c.created_at)}</p></td>
        {showCompleted && (
          <td className="px-4 py-3"><p className="text-sm text-muted">{c.completed_at ? fmt(c.completed_at) : '-'}</p></td>
        )}
        <td className="px-4 py-3 text-right">
          <Link href={`/checklist/${c.id}`} className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-colors inline-flex" title="Ver respostas">
            <FiEye className="w-4 h-4" />
          </Link>
        </td>
      </tr>
    )
  }

  if (loading) return <LoadingPage />

  const pct = (n: number) => summary.total > 0 ? Math.round((n / summary.total) * 100) : 0

  return (
    <div className="min-h-screen bg-page">
      <PageContainer>
        {/* Tabs + Period */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button onClick={() => { setActiveTab('overview'); setResponsePage(1) }}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}>
            <span className="flex items-center gap-2"><FiBarChart2 className="w-4 h-4" />Meus Checklists</span>
          </button>
          <button onClick={() => { setActiveTab('responses'); setResponsePage(1) }}
            className={`px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === 'responses' ? 'btn-primary' : 'btn-secondary'}`}>
            <span className="flex items-center gap-2"><FiClipboard className="w-4 h-4" />Respostas</span>
          </button>
          <div className="flex-1" />
          {(['7d', '30d', '90d'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${period === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
            </button>
          ))}
        </div>

        {/* ====== Overview Tab ====== */}
        {activeTab === 'overview' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="card p-4 border-l-4 border-l-primary">
                <p className="text-xs text-muted mb-1">Total de Checklists</p>
                <p className="text-3xl font-bold text-main">{summary.total}</p>
                <p className="text-[10px] text-muted mt-1">Ultimos {period === '7d' ? '7' : period === '30d' ? '30' : '90'} dias</p>
              </div>
              <div className="card p-4 border-l-4 border-l-success">
                <p className="text-xs text-muted mb-1">Concluidos</p>
                <p className="text-3xl font-bold text-success">{summary.completed}</p>
                <p className="text-[10px] text-muted mt-1">{pct(summary.completed)}% do total</p>
              </div>
              <div className="card p-4 border-l-4 border-l-warning">
                <p className="text-xs text-muted mb-1">Em Andamento</p>
                <p className="text-3xl font-bold text-warning">{summary.inProgress}</p>
                <p className="text-[10px] text-muted mt-1">{pct(summary.inProgress)}% do total</p>
              </div>
              <div className="card p-4 border-l-4 border-l-error">
                <p className="text-xs text-muted mb-1">Incompletos</p>
                <p className="text-3xl font-bold text-error">{summary.incomplete}</p>
                <p className="text-[10px] text-muted mt-1">{pct(summary.incomplete)}% do total</p>
              </div>
            </div>

            {/* Completion Rate Bar */}
            {summary.total > 0 && (
              <div className="card p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-main">Taxa de Conclusao</p>
                  <p className="text-sm font-bold text-main">{pct(summary.completed)}%</p>
                </div>
                <div className="w-full h-3 bg-surface-hover rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-500"
                    style={{ width: `${pct(summary.completed)}%` }} />
                </div>
              </div>
            )}

            {/* Recent Checklists */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-main">Checklists Recentes</h3>
              {exportDropdown}
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-hover">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Checklist</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Data</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {checklists.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-muted">Nenhum checklist encontrado no periodo</td></tr>
                    ) : checklists.slice(0, 10).map(c => checklistRow(c, false))}
                  </tbody>
                </table>
              </div>
            </div>

            {checklists.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5"><FiCheckCircle className="w-4 h-4 text-success" /><span className="text-xs text-muted">Concluido/Validado</span></div>
                <div className="flex items-center gap-1.5"><FiClock className="w-4 h-4 text-warning" /><span className="text-xs text-muted">Em Andamento</span></div>
                <div className="flex items-center gap-1.5"><FiAlertCircle className="w-4 h-4 text-error" /><span className="text-xs text-muted">Incompleto/Rascunho</span></div>
              </div>
            )}
          </>
        )}

        {/* ====== Responses Tab ====== */}
        {activeTab === 'responses' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted">{checklists.length} checklist(s) no periodo</p>
              {exportDropdown}
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-hover">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Checklist</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Criado em</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted">Concluido em</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle">
                    {paginatedChecklists.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">Nenhum checklist encontrado no periodo</td></tr>
                    ) : paginatedChecklists.map(c => checklistRow(c, true))}
                  </tbody>
                </table>
              </div>

              {responseTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
                  <p className="text-sm text-muted">Pagina {responsePage} de {responseTotalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setResponsePage(p => Math.max(1, p - 1))} disabled={responsePage === 1} className="btn-ghost p-2 disabled:opacity-50">
                      <FiChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setResponsePage(p => Math.min(responseTotalPages, p + 1))} disabled={responsePage === responseTotalPages} className="btn-ghost p-2 disabled:opacity-50">
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  )
}
