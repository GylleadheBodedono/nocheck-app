'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { FiWifiOff, FiWifi, FiRefreshCw } from 'react-icons/fi'
import { getPendingChecklists } from '@/lib/offlineStorage'
import { syncAll } from '@/lib/syncService'

type OfflineIndicatorProps = {
  showSyncButton?: boolean
  className?: string
}

/**
 * Componente que indica status de conexao e pendencias de sync
 * Mostra badge discreto quando offline ou tem pendencias
 */
export function OfflineIndicator({ showSyncButton = true, className = '' }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const isSyncingRef = useRef(false)

  const handleSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return

    isSyncingRef.current = true
    setIsSyncing(true)
    try {
      const { synced } = await syncAll()
      if (synced > 0) {
        setPendingCount(prev => Math.max(0, prev - synced))
      }
    } catch {
      // Ignora erro
    }
    setIsSyncing(false)
    isSyncingRef.current = false
  }, [])

  useEffect(() => {
    // Inicializa estado de conexao
    setIsOnline(navigator.onLine)

    // Verifica pendencias
    const checkPending = async () => {
      try {
        const pending = await getPendingChecklists()
        setPendingCount(pending.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length)
      } catch {
        // Ignora erro
      }
    }
    checkPending()

    // Monitora conexao
    const handleOnline = () => {
      setIsOnline(true)
      setShowBanner(true)
      // Esconde banner apos 3 segundos
      setTimeout(() => setShowBanner(false), 3000)
      // Sincroniza automaticamente
      handleSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowBanner(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Verifica pendencias a cada 30 segundos
    const interval = setInterval(checkPending, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [handleSync])

  // Se online e sem pendencias, nao mostra nada
  if (isOnline && pendingCount === 0 && !showBanner) {
    return null
  }

  return (
    <div className={className}>
      {/* Banner de status quando muda conexao */}
      {showBanner && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium transition-all ${
            isOnline
              ? 'bg-success text-success-foreground'
              : 'bg-warning text-warning-foreground'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            {isOnline ? (
              <>
                <FiWifi className="w-4 h-4" />
                Conexao restaurada! Sincronizando dados...
              </>
            ) : (
              <>
                <FiWifiOff className="w-4 h-4" />
                Voce esta offline. Dados serao salvos localmente.
              </>
            )}
          </div>
        </div>
      )}

      {/* Badge fixo quando offline ou tem pendencias */}
      {(!isOnline || pendingCount > 0) && (
        <div className="fixed bottom-4 right-4 z-40">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg ${
              isOnline ? 'bg-surface border border-default' : 'bg-warning'
            }`}
          >
            {!isOnline && (
              <FiWifiOff className={`w-4 h-4 ${isOnline ? 'text-muted' : 'text-warning-foreground'}`} />
            )}

            {pendingCount > 0 && (
              <span className={`text-sm font-medium ${isOnline ? 'text-main' : 'text-warning-foreground'}`}>
                {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
              </span>
            )}

            {showSyncButton && isOnline && pendingCount > 0 && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="p-1 hover:bg-surface-hover rounded-full transition-colors"
                title="Sincronizar agora"
              >
                <FiRefreshCw className={`w-4 h-4 text-primary ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
