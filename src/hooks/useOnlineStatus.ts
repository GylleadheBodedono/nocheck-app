'use client'

import { useState, useEffect } from 'react'

/**
 * Hook simples para monitorar o status de conexão com a internet.
 * Inicializa com `navigator.onLine` e atualiza via eventos `online`/`offline` da janela.
 * @returns `true` se o dispositivo está conectado, `false` caso offline.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
