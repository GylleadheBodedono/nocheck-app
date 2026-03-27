'use client'

import { memo } from 'react'
import { FiClock, FiX } from 'react-icons/fi'

type LogEntry = {
  id: number
  action: string
  created_at: string
  user_id: string | null
  details: Record<string, unknown> | null
}

type Props = {
  open: boolean
  label: string
  logs: LogEntry[]
  loading: boolean
  onClose: () => void
}

export const LogsModal = memo(function LogsModal({ open, label, logs, loading, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-subtle">
          <div>
            <h2 className="font-semibold text-main flex items-center gap-2">
              <FiClock className="w-4 h-4 text-primary" /> Logs de Atividade
            </h2>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {loading ? (
            <p className="text-center text-muted text-sm py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">Nenhum log encontrado para este checklist.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="card p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="text-xs text-secondary space-y-0.5 pt-1">
                      {Object.entries(log.details).map(([k, v]) => (
                        <p key={k}>
                          <span className="text-muted">{k}:</span>{' '}
                          {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                        </p>
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
  )
})
