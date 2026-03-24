'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { PageContainer } from '@/components/ui/PageContainer'
import { FiAlertCircle, FiAlertTriangle, FiInfo, FiTrash2, FiChevronDown, FiChevronUp, FiRefreshCw } from 'react-icons/fi'

interface ClientLog {
  id: number
  user_id: string | null
  level: 'error' | 'warn' | 'info'
  message: string
  stack: string | null
  url: string | null
  user_agent: string | null
  context: Record<string, unknown> | null
  created_at: string
  user_name?: string
  user_email?: string
}

const LEVEL_CONFIG = {
  error: { label: 'Erro', cls: 'bg-red-500/15 text-red-500', icon: FiAlertCircle },
  warn:  { label: 'Aviso', cls: 'bg-amber-500/15 text-amber-500', icon: FiAlertTriangle },
  info:  { label: 'Info', cls: 'bg-blue-500/15 text-blue-500', icon: FiInfo },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
}

function shortUrl(url: string | null) {
  if (!url) return '—'
  try { return new URL(url).pathname } catch { return url }
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ClientLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  const [filterUser, setFilterUser] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const fetchLogs = async () => {
    if (!isSupabaseConfigured || !supabase) return
    setLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('client_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!data) { setLogs([]); return }

      // Buscar nomes de usuários únicos
      const userIds = [...new Set((data as ClientLog[]).filter(l => l.user_id).map(l => l.user_id!))]
      let userMap: Record<string, { name: string; email: string }> = {}

      if (userIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: users } = await (supabase as any)
          .from('users')
          .select('id, full_name, email')
          .in('id', userIds)
        if (users) {
          userMap = Object.fromEntries(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (users as any[]).map((u: { id: string; full_name: string; email: string }) => [
              u.id,
              { name: u.full_name, email: u.email },
            ])
          )
        }
      }

      setLogs(
        (data as ClientLog[]).map(l => ({
          ...l,
          user_name: l.user_id ? userMap[l.user_id]?.name : undefined,
          user_email: l.user_id ? userMap[l.user_id]?.email : undefined,
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterLevel !== 'all' && l.level !== filterLevel) return false
      if (filterUser) {
        const q = filterUser.toLowerCase()
        if (!(l.user_name?.toLowerCase().includes(q) || l.user_email?.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [logs, filterLevel, filterUser])

  const counts = useMemo(() => ({
    error: logs.filter(l => l.level === 'error').length,
    warn: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
  }), [logs])

  const handleClearAll = async () => {
    if (!confirm('Apagar todos os logs? Esta ação não pode ser desfeita.')) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('client_logs').delete().neq('id', 0)
    setLogs([])
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-main">Logs do Cliente</h1>
        <p className="text-sm text-muted mt-1">Erros e eventos capturados nos dispositivos dos usuários</p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(['error', 'warn', 'info'] as const).map(level => {
          const cfg = LEVEL_CONFIG[level]
          const Icon = cfg.icon
          return (
            <button
              key={level}
              onClick={() => setFilterLevel(filterLevel === level ? 'all' : level)}
              className={`card p-4 flex items-center gap-3 text-left transition-all ${filterLevel === level ? 'ring-2 ring-primary' : ''}`}
            >
              <span className={`p-2 rounded-lg ${cfg.cls}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xl font-bold text-main">{counts[level]}</p>
                <p className="text-xs text-muted">{cfg.label}{counts[level] !== 1 ? 's' : ''}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Filtrar por usuário..."
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          className="input text-sm flex-1 min-w-[180px]"
        />
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value as typeof filterLevel)}
          className="input text-sm w-auto"
        >
          <option value="all">Todos os níveis</option>
          <option value="error">Erros</option>
          <option value="warn">Avisos</option>
          <option value="info">Info</option>
        </select>
        <button onClick={fetchLogs} className="btn-ghost p-2" title="Atualizar">
          <FiRefreshCw className="w-4 h-4" />
        </button>
        <button onClick={handleClearAll} className="btn-ghost p-2 text-red-500 hover:bg-red-500/10" title="Limpar todos">
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted text-sm">Carregando logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">Nenhum log encontrado</div>
        ) : (
          <div className="divide-y divide-subtle">
            {filtered.map(log => {
              const cfg = LEVEL_CONFIG[log.level]
              const Icon = cfg.icon
              const isExpanded = expandedId === log.id
              const hasDetail = log.stack || log.context

              return (
                <div key={log.id} className="hover:bg-surface-hover/40 transition-colors">
                  <div
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                    onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                  >
                    <span className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${cfg.cls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-main font-medium truncate">{log.message}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="text-xs text-muted">{formatDate(log.created_at)}</span>
                        {log.user_name && (
                          <span className="text-xs text-secondary">{log.user_name}</span>
                        )}
                        <span className="text-xs text-muted font-mono">{shortUrl(log.url)}</span>
                        {log.context?.checklist_id != null && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            checklist #{String(log.context.checklist_id)}
                          </span>
                        )}
                      </div>
                    </div>
                    {hasDetail && (
                      <span className="flex-shrink-0 text-muted mt-1">
                        {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                      </span>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      {log.stack && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">Stack trace</p>
                          <pre className="text-xs bg-surface-hover rounded-xl p-3 overflow-x-auto text-secondary whitespace-pre-wrap">{log.stack}</pre>
                        </div>
                      )}
                      {log.context && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">Contexto</p>
                          <pre className="text-xs bg-surface-hover rounded-xl p-3 overflow-x-auto text-secondary whitespace-pre-wrap">{JSON.stringify(log.context, null, 2)}</pre>
                        </div>
                      )}
                      {log.user_agent && (
                        <p className="text-xs text-muted font-mono">{log.user_agent}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
