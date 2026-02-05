'use client'

import { useEffect, useState } from 'react'
import { FiDownload, FiX } from 'react-icons/fi'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Armazena o evento globalmente
let deferredPromptGlobal: BeforeInstallPromptEvent | null = null

// Listener global - adicionado apenas uma vez
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPromptGlobal = e as BeforeInstallPromptEvent
    console.log('[PWA-Global] Evento capturado e armazenado')
  })
}

export function PWAInstall() {
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Verificar se já dispensou
    const dismissed = localStorage.getItem('pwa-banner-dismissed')
    console.log('[PWA] useEffect - dismissed:', dismissed)

    if (dismissed === 'true') {
      console.log('[PWA] Banner já dispensado, não mostrando')
      return
    }

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Verificar se já está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) {
      console.log('[PWA] Já está instalado como PWA')
      return
    }

    // Detecta iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent)
    if (isIOSDevice) {
      setIsIOS(true)
      setTimeout(() => setShowBanner(true), 2000)
      return
    }

    // Se já temos o evento, mostra o banner
    if (deferredPromptGlobal) {
      console.log('[PWA] Evento já disponível, mostrando banner')
      setShowBanner(true)
    } else {
      // Aguarda um pouco para o evento ser capturado
      const checkInterval = setInterval(() => {
        if (deferredPromptGlobal && !localStorage.getItem('pwa-banner-dismissed')) {
          console.log('[PWA] Evento detectado via polling, mostrando banner')
          setShowBanner(true)
          clearInterval(checkInterval)
        }
      }, 500)

      // Para de verificar após 10 segundos
      setTimeout(() => clearInterval(checkInterval), 10000)

      return () => clearInterval(checkInterval)
    }
  }, [])

  const handleInstall = async () => {
    console.log('[PWA] Botão Instalar clicado')
    if (!deferredPromptGlobal) {
      console.log('[PWA] Sem evento para prompt')
      return
    }

    try {
      await deferredPromptGlobal.prompt()
      const { outcome } = await deferredPromptGlobal.userChoice
      console.log('[PWA] Resultado:', outcome)

      if (outcome === 'accepted') {
        localStorage.setItem('pwa-banner-dismissed', 'true')
      }
    } catch (err) {
      console.error('[PWA] Erro no prompt:', err)
    }

    deferredPromptGlobal = null
    setShowBanner(false)
  }

  const handleDismiss = () => {
    console.log('[PWA] *** DISMISS CLICADO ***')
    localStorage.setItem('pwa-banner-dismissed', 'true')
    localStorage.setItem('pwa-banner-dismissed-time', new Date().toISOString())
    setShowBanner(false)
    console.log('[PWA] Banner dispensado e salvo')
  }

  // Não renderiza se não deve mostrar
  if (!showBanner) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm"
      style={{ pointerEvents: 'auto' }}
    >
      <div className="card p-4 shadow-theme-lg border border-primary/30 bg-surface">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <FiDownload className="w-5 h-5 text-primary" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-main text-sm">Instalar NoCheck</h3>

            {isIOS ? (
              <>
                <p className="text-xs text-muted mt-1">
                  Toque em <span className="font-medium">Compartilhar</span> e depois em <span className="font-medium">&quot;Adicionar a Tela Inicial&quot;</span>
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('[PWA] Botão Entendi clicado')
                      handleDismiss()
                    }}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Entendi
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted mt-1">
                  Adicione o app na tela inicial para acesso rapido
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('[PWA] Botão Instalar clicado')
                      handleInstall()
                    }}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Instalar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('[PWA] Botão Depois clicado')
                      handleDismiss()
                    }}
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    Depois
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              console.log('[PWA] Botão X clicado')
              handleDismiss()
            }}
            className="p-1 text-muted hover:text-main"
            aria-label="Fechar"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook to check online status
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

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
