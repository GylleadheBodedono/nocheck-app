'use client'

import { useEffect, useState } from 'react'
import { FiCloud, FiCloudOff, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { subscribeSyncStatus, syncAll, initSyncService, type SyncStatus } from '@/lib/syncService'

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  })
  const [isOnline, setIsOnline] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Subscribe to sync status
    const unsubscribe = subscribeSyncStatus(setStatus)

    // Initialize sync service
    const cleanup = initSyncService()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
      cleanup()
    }
  }, [])

  const handleSync = () => {
    if (!status.isSyncing && isOnline) {
      syncAll()
    }
  }

  // Don't show if nothing pending and online
  if (status.pendingCount === 0 && isOnline && !status.lastError) {
    return null
  }

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {/* Main button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all ${
          !isOnline
            ? 'bg-warning text-warning-foreground'
            : status.pendingCount > 0
            ? 'bg-primary text-primary-foreground'
            : status.lastError
            ? 'bg-red-500 text-white'
            : 'bg-success text-white'
        }`}
      >
        {!isOnline ? (
          <>
            <FiCloudOff className="w-4 h-4" />
            <span className="text-sm font-medium">Offline</span>
          </>
        ) : status.isSyncing ? (
          <>
            <FiRefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Sincronizando...</span>
          </>
        ) : status.pendingCount > 0 ? (
          <>
            <FiCloud className="w-4 h-4" />
            <span className="text-sm font-medium">{status.pendingCount} pendente(s)</span>
          </>
        ) : status.lastError ? (
          <>
            <FiAlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Erro</span>
          </>
        ) : (
          <>
            <FiCheck className="w-4 h-4" />
            <span className="text-sm font-medium">Sincronizado</span>
          </>
        )}
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="absolute bottom-12 right-0 w-72 card p-4 shadow-theme-lg">
          <h3 className="font-semibold text-main mb-3 flex items-center gap-2">
            <FiCloud className="w-4 h-4" />
            Sincronização
          </h3>

          <div className="space-y-3">
            {/* Online status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Status:</span>
              <span className={`font-medium ${isOnline ? 'text-success' : 'text-warning'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Pending count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Pendentes:</span>
              <span className="font-medium text-main">{status.pendingCount}</span>
            </div>

            {/* Last sync */}
            {status.lastSyncAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Última sync:</span>
                <span className="text-secondary">
                  {new Date(status.lastSyncAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            )}

            {/* Error message */}
            {status.lastError && (
              <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-400">{status.lastError}</p>
              </div>
            )}

            {/* Sync button */}
            {status.pendingCount > 0 && isOnline && (
              <button
                onClick={handleSync}
                disabled={status.isSyncing}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <FiRefreshCw className={`w-4 h-4 ${status.isSyncing ? 'animate-spin' : ''}`} />
                {status.isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
              </button>
            )}

            {/* Info text */}
            <p className="text-xs text-muted">
              {isOnline
                ? 'Os checklists pendentes serão enviados automaticamente.'
                : 'Seus checklists serão salvos localmente e enviados quando voltar a ficar online.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
