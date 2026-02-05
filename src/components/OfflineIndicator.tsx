'use client'

import { useEffect, useState } from 'react'
import { FiWifiOff } from 'react-icons/fi'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [showIndicator, setShowIndicator] = useState(false)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)
    setShowIndicator(!navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      // Show "back online" briefly
      setTimeout(() => setShowIndicator(false), 2000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowIndicator(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!showIndicator) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] py-2 px-4 text-center text-sm font-medium transition-all ${
        isOnline
          ? 'bg-success text-success-foreground'
          : 'bg-warning text-warning-foreground'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {!isOnline && <FiWifiOff className="w-4 h-4" />}
        {isOnline ? 'Conexao restaurada!' : 'Voce esta offline - dados serao sincronizados quando a conexao voltar'}
      </div>
    </div>
  )
}
