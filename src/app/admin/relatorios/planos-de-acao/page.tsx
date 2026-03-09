'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import {
  FiClipboard,
  FiDownload,
  FiChevronDown,
  FiX,
  FiImage,
  FiCheckCircle,
  FiAlertTriangle,
  FiAlertCircle,
  FiExternalLink,
  FiClock,
  FiActivity,
  FiAlertOctagon,
  FiChevronLeft,
  FiChevronRight,
  FiRepeat,
} from 'react-icons/fi'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header, Select } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import {
  fetchActionPlanReport,
  type ActionPlanReportItem,
  type ActionPlanReportSummary,
  type ActionPlanReportFilters,
} from '@/lib/actionPlanReportQueries'
import {
  exportActionPlanToCSV,
  exportActionPlanToTXT,
  exportActionPlanToExcel,
  exportActionPlanToPDF,
} from '@/lib/exportUtils'

type PeriodPreset = 'this_week' | 'last_week' | '30d' | 'custom'

function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  switch (preset) {
    case 'this_week': {
      const day = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + 1)
      monday.setHours(0, 0, 0, 0)
      return { from: monday.toISOString(), to: today.toISOString() }
    }
    case 'last_week': {
      const day = now.getDay() || 7
      const thisMonday = new Date(now)
      thisMonday.setDate(now.getDate() - day + 1)
      const lastMonday = new Date(thisMonday)
      lastMonday.setDate(thisMonday.getDate() - 7)
      lastMonday.setHours(0, 0, 0, 0)
      const lastSunday = new Date(thisMonday)
      lastSunday.setDate(thisMonday.getDate() - 1)
      lastSunday.setHours(23, 59, 59, 999)
      return { from: lastMonday.toISOString(), to: lastSunday.toISOString() }
    }
    case '30d': {
      const cutoff = new Date(now)
      cutoff.setDate(now.getDate() - 30)
      cutoff.setHours(0, 0, 0, 0)
      return { from: cutoff.toISOString(), to: today.toISOString() }
    }
    default:
      return { from: today.toISOString(), to: today.toISOString() }
  }
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critica: { label: 'Critica', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
  alta: { label: 'Alta', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  media: { label: 'Media', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  baixa: { label: 'Baixa', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aberto: { label: 'Aberto', color: 'text-yellow-600' },
  em_andamento: { label: 'Em Andamento', color: 'text-blue-600' },
  concluido: { label: 'Concluido', color: 'text-green-600' },
  vencido: { label: 'Vencido', color: 'text-red-600' },
  cancelado: { label: 'Cancelado', color: 'text-gray-500' },
}

const PAGE_SIZE = 20

export default function PlanoDeAcaoReportPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // State
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ActionPlanReportItem[]>([])
  const [summary, setSummary] = useState<ActionPlanReportSummary>({ total: 0, concluidos: 0, vencidos: 0, emAndamento: 0 })
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [storeFilter, setStoreFilter] = useState<number | undefined>()
  const [templateFilter, setTemplateFilter] = useState<number | undefined>()
  const [severityFilter, setSeverityFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>()
  const [page, setPage] = useState(1)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [modalPhoto, setModalPhoto] = useState<string | null>(null)

  // Dropdown data
  const [stores, setStores] = useState<{ id: number; name: string }[]>([])
  const [templates, setTemplates] = useState<{ id: number; name: string }[]>([])
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([])

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    // Auth check
    let isAdminUser = false
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        isAdminUser = profile?.is_admin || false
      }
    } catch {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          const cachedUser = await getUserCache(cachedAuth.userId)
          isAdminUser = cachedUser?.is_admin || false
        }
      } catch { /* ignore */ }
    }

    if (!isAdminUser) {
      router.push(APP_CONFIG.routes.dashboard)
      return
    }

    setLoading(true)

    try {
      // Load filter dropdown data (once)
      if (stores.length === 0) {
        const [storesRes, templatesRes, usersRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('stores').select('id, name').eq('is_active', true).order('name'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('checklist_templates').select('id, name').eq('is_active', true).order('name'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('users').select('id, full_name').eq('is_active', true).order('full_name'),
        ])
        if (storesRes.data) setStores(storesRes.data)
        if (templatesRes.data) setTemplates(templatesRes.data)
        if (usersRes.data) setUsers(usersRes.data)
      }

      // Date range
      let dateFrom: string, dateTo: string
      if (periodPreset === 'custom' && customFrom && customTo) {
        dateFrom = new Date(customFrom + 'T00:00:00').toISOString()
        dateTo = new Date(customTo + 'T23:59:59').toISOString()
      } else if (periodPreset !== 'custom') {
        const range = getDateRange(periodPreset)
        dateFrom = range.from
        dateTo = range.to
      } else {
        setLoading(false)
        return
      }

      const filters: ActionPlanReportFilters = {
        dateFrom,
        dateTo,
        storeId: storeFilter,
        templateId: templateFilter,
        severity: severityFilter,
        status: statusFilter,
        assigneeId: assigneeFilter,
      }

      const result = await fetchActionPlanReport(supabase, filters)
      setItems(result.items)
      setSummary(result.summary)
      setPage(1)
    } catch (err) {
      console.error('[PlanosReport] Erro ao buscar dados:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, periodPreset, customFrom, customTo, storeFilter, templateFilter, severityFilter, statusFilter, assigneeFilter, router, stores.length])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Pagination
  const totalPages = Math.ceil(items.length / PAGE_SIZE)
  const paginatedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Export handlers
  const handleExport = async (format: 'csv' | 'txt' | 'xlsx') => {
    setExportMenuOpen(false)
    setExporting(true)
    try {
      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `relatorio_planos_acao_${timestamp}`
      if (format === 'csv') exportActionPlanToCSV(items, `${filename}.csv`)
      else if (format === 'txt') exportActionPlanToTXT(items, `${filename}.txt`)
      else await exportActionPlanToExcel(items, `${filename}.xlsx`)
    } catch (err) {
      console.error('[PlanosReport] Erro ao exportar:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = async () => {
    if (exportingPdf || items.length === 0) return
    setExportMenuOpen(false)
    setExportingPdf(true)
    try {
      let dateFrom: string, dateTo: string
      if (periodPreset === 'custom' && customFrom && customTo) {
        dateFrom = new Date(customFrom + 'T00:00:00').toISOString()
        dateTo = new Date(customTo + 'T23:59:59').toISOString()
      } else {
        const range = getDateRange(periodPreset as Exclude<PeriodPreset, 'custom'>)
        dateFrom = range.from
        dateTo = range.to
      }
      await exportActionPlanToPDF(items, {
        dateFrom,
        dateTo,
        storeName: stores.find(s => s.id === storeFilter)?.name,
        templateName: templates.find(t => t.id === templateFilter)?.name,
        severityLabel: severityFilter ? (SEVERITY_CONFIG[severityFilter]?.label || severityFilter) : undefined,
        statusLabel: statusFilter ? (STATUS_CONFIG[statusFilter]?.label || statusFilter) : undefined,
        assigneeName: assigneeFilter ? users.find(u => u.id === assigneeFilter)?.full_name : undefined,
      })
    } catch (err) {
      console.error('[PlanosReport] Erro ao exportar PDF:', err)
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="Relatorio de Planos de Acao"
        icon={FiClipboard}
        backHref={APP_CONFIG.routes.adminReports}
      />

      <main className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="card p-4 sticky top-0 z-10 space-y-3">
          {/* Period presets */}
          <div className="flex flex-wrap gap-2">
            {([
              { key: 'this_week', label: 'Esta semana' },
              { key: 'last_week', label: 'Semana passada' },
              { key: '30d', label: 'Ultimos 30 dias' },
              { key: 'custom', label: 'Periodo custom' },
            ] as { key: PeriodPreset; label: string }[]).map(p => (
              <button
                key={p.key}
                onClick={() => setPeriodPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  periodPreset === p.key
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-muted hover:text-main'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {periodPreset === 'custom' && (
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="input text-sm"
              />
              <span className="text-muted text-sm">ate</span>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="input text-sm"
              />
            </div>
          )}

          {/* Filter dropdowns + export */}
          <div className="flex flex-wrap gap-2 items-center">
            <Select
              value={String(storeFilter ?? '')}
              onChange={v => setStoreFilter(v ? Number(v) : undefined)}
              placeholder="Todas as lojas"
              className="text-sm min-w-[140px]"
              options={stores.map(s => ({ value: String(s.id), label: s.name }))}
            />

            <Select
              value={String(templateFilter ?? '')}
              onChange={v => setTemplateFilter(v ? Number(v) : undefined)}
              placeholder="Todos templates"
              className="text-sm min-w-[140px]"
              options={templates.map(t => ({ value: String(t.id), label: t.name }))}
            />

            <Select
              value={severityFilter ?? ''}
              onChange={v => setSeverityFilter(v || undefined)}
              placeholder="Severidade"
              className="text-sm min-w-[120px]"
              options={[
                { value: 'critica', label: 'Critica' },
                { value: 'alta',    label: 'Alta' },
                { value: 'media',   label: 'Media' },
                { value: 'baixa',   label: 'Baixa' },
              ]}
            />

            <Select
              value={statusFilter ?? ''}
              onChange={v => setStatusFilter(v || undefined)}
              placeholder="Status"
              className="text-sm min-w-[120px]"
              options={[
                { value: 'aberto',       label: 'Aberto' },
                { value: 'em_andamento', label: 'Em Andamento' },
                { value: 'concluido',    label: 'Concluido' },
                { value: 'vencido',      label: 'Vencido' },
                { value: 'cancelado',    label: 'Cancelado' },
              ]}
            />

            <Select
              value={assigneeFilter ?? ''}
              onChange={v => setAssigneeFilter(v || undefined)}
              placeholder="Responsavel"
              className="text-sm min-w-[140px]"
              options={users.map(u => ({ value: u.id, label: u.full_name }))}
            />

            <div className="flex-1" />

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={items.length === 0 || exporting || exportingPdf}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <FiDownload className="text-base" />
                {exportingPdf ? 'Gerando PDF...' : exporting ? 'Exportando...' : 'Exportar'}
                <FiChevronDown className="text-xs" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[160px]">
                  <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-sm text-left hover:bg-surface-hover">CSV</button>
                  <button onClick={() => handleExport('xlsx')} className="w-full px-4 py-2 text-sm text-left hover:bg-surface-hover">Excel</button>
                  <button onClick={() => handleExport('txt')} className="w-full px-4 py-2 text-sm text-left hover:bg-surface-hover">TXT</button>
                  <button
                    onClick={handleExportPdf}
                    disabled={exportingPdf}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-surface-hover flex items-center gap-2 disabled:opacity-50"
                  >
                    <FiDownload className="text-sm" />
                    {exportingPdf ? 'Gerando PDF...' : 'PDF (com fotos)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={<FiClipboard />} label="Total" value={summary.total} color="text-blue-500" />
          <SummaryCard icon={<FiCheckCircle />} label="Concluidos" value={summary.concluidos} color="text-green-500" />
          <SummaryCard icon={<FiAlertOctagon />} label="Vencidos" value={summary.vencidos} color="text-red-500" />
          <SummaryCard icon={<FiActivity />} label="Em Andamento" value={summary.emAndamento} color="text-yellow-500" />
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div className="card p-12 text-center">
            <FiClipboard className="text-4xl text-muted mx-auto mb-3" />
            <p className="text-muted">Nenhum plano de acao encontrado no periodo selecionado.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted">{items.length} plano(s) encontrado(s)</p>

            <div className="space-y-4">
              {paginatedItems.map(item => (
                <ActionPlanCard key={item.id} item={item} onPhotoClick={setModalPhoto} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-muted hover:text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-muted">
                  Pagina {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-muted hover:text-main hover:bg-surface-hover disabled:opacity-30 transition-colors"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Photo modal */}
      {modalPhoto && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setModalPhoto(null)}
        >
          <button
            onClick={() => setModalPhoto(null)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
          >
            <FiX className="text-xl" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={modalPhoto}
            alt="Foto ampliada"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

// === Components ===

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-main">{value}</p>
    </div>
  )
}

function ActionPlanCard({ item, onPhotoClick }: { item: ActionPlanReportItem; onPhotoClick: (url: string) => void }) {
  const sev = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.media
  const stat = STATUS_CONFIG[item.status] || STATUS_CONFIG.aberto
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = !['concluido', 'cancelado'].includes(item.status) && item.deadline && item.deadline < today

  return (
    <div className="card p-4 space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${sev.bg} ${sev.color}`}>
          {sev.label}
        </span>
        <span className="text-sm text-muted">{item.storeNames.join(', ')}</span>
        <span className="text-muted">·</span>
        <span className="text-sm text-muted">{item.templateName}</span>
        <span className="text-muted">·</span>
        <span className="text-sm font-medium text-main">{item.fieldName}</span>
        {item.isReincidencia && (
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-error/20 text-error flex items-center gap-1">
            <FiRepeat className="w-3 h-3" />
            {item.reincidenciaCount}x
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-main">{item.title}</h3>

      {/* Details row */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted flex items-center gap-1">
          <FiClock className="w-3.5 h-3.5" />
          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
        </span>
        <span className="text-muted">{item.assignedUserName}</span>
        <span className={`font-medium ${stat.color}`}>{stat.label}</span>
        <span className={`flex items-center gap-1 ${isOverdue ? 'text-error font-medium' : 'text-muted'}`}>
          <FiAlertTriangle className={`w-3.5 h-3.5 ${isOverdue ? '' : 'hidden'}`} />
          Prazo: {item.deadline ? new Date(item.deadline).toLocaleDateString('pt-BR') : '-'}
        </span>
        {item.nonConformityValue && (
          <span className="text-main">
            <FiAlertCircle className="inline mr-1 text-warning" />
            {item.nonConformityValue}
          </span>
        )}
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-muted line-clamp-2">{item.description}</p>
      )}

      {/* Completion section */}
      {item.status === 'concluido' && item.completionText && (
        <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
          <p className="text-xs text-muted mb-0.5 flex items-center gap-1">
            <FiCheckCircle className="w-3 h-3 text-green-500" />
            Texto de conclusao
            {item.completedAt && (
              <span className="ml-1">— {new Date(item.completedAt).toLocaleDateString('pt-BR')}</span>
            )}
          </p>
          <p className="text-sm text-main">{item.completionText}</p>
        </div>
      )}

      {/* Evidence photos */}
      {item.evidencePhotos.length > 0 ? (
        <div>
          <p className="text-xs text-muted mb-1">Fotos Evidencia ({item.evidencePhotos.length})</p>
          <div className="flex flex-wrap gap-2">
            {item.evidencePhotos.map((url, i) => (
              <PhotoThumb
                key={`ev-${i}`}
                url={url}
                borderColor="border-green-500 dark:border-green-400"
                onClick={() => onPhotoClick(url)}
              />
            ))}
          </div>
        </div>
      ) : item.status === 'concluido' ? (
        <span className="inline-block px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800 text-muted">
          Sem fotos de evidencia
        </span>
      ) : null}

      {/* Link to action plan */}
      <Link
        href={`${APP_CONFIG.routes.adminActionPlans}/${item.id}`}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Ver plano de acao <FiExternalLink />
      </Link>
    </div>
  )
}

function PhotoThumb({ url, borderColor, onClick }: { url: string; borderColor: string; onClick: () => void }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div className="w-20 h-20 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-default">
        <FiImage className="text-gray-400 text-lg" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Foto evidencia"
      className={`w-20 h-20 rounded-lg object-cover border-2 ${borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
      onError={() => setError(true)}
      onClick={onClick}
    />
  )
}
