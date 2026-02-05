'use client'

import { useState, useCallback } from 'react'

type PrecacheStatus = {
  isReady: boolean
  isCaching: boolean
  progress: number
  error: string | null
}

/**
 * Hook para fazer precache de toda a aplicacao
 * Deve ser chamado apos o login para garantir funcionamento offline
 */
export function usePrecache() {
  const [status, setStatus] = useState<PrecacheStatus>({
    isReady: false,
    isCaching: false,
    progress: 0,
    error: null,
  })

  // Verifica se o Service Worker esta ativo
  const checkServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    if (!('serviceWorker' in navigator)) {
      console.log('[Precache] Service Worker nao suportado')
      return null
    }

    try {
      const registration = await navigator.serviceWorker.ready
      return registration
    } catch {
      return null
    }
  }, [])

  // Faz precache de todas as paginas essenciais
  const precacheApp = useCallback(async () => {
    const registration = await checkServiceWorker()
    if (!registration?.active) {
      console.log('[Precache] Service Worker nao ativo')
      return
    }

    setStatus(prev => ({ ...prev, isCaching: true, progress: 0 }))

    try {
      // Lista de URLs para cachear
      const urlsToCache = [
        '/',
        '/login',
        '/dashboard',
        '/offline',
        '/checklist/novo',
        '/manifest.json',
        '/Logo.png',
        '/Logo-dark.png',
      ]

      // Envia mensagem para o SW fazer precache
      registration.active.postMessage({
        type: 'PRECACHE_APP'
      })

      // Tambem faz fetch das paginas para garantir que os assets JS/CSS sejam cacheados
      let completed = 0
      for (const url of urlsToCache) {
        try {
          await fetch(url)
          completed++
          setStatus(prev => ({
            ...prev,
            progress: Math.round((completed / urlsToCache.length) * 100)
          }))
        } catch {
          // Ignora erros
        }
      }

      setStatus(prev => ({
        ...prev,
        isReady: true,
        isCaching: false,
        progress: 100,
      }))

      console.log('[Precache] App cacheado com sucesso')
    } catch (error) {
      console.error('[Precache] Erro:', error)
      setStatus(prev => ({
        ...prev,
        isCaching: false,
        error: 'Erro ao cachear app',
      }))
    }
  }, [checkServiceWorker])

  // Limpa o cache
  const clearCache = useCallback(async () => {
    const registration = await checkServiceWorker()
    if (!registration?.active) return

    registration.active.postMessage({ type: 'CLEAR_CACHE' })

    setStatus({
      isReady: false,
      isCaching: false,
      progress: 0,
      error: null,
    })

    console.log('[Precache] Cache limpo')
  }, [checkServiceWorker])

  return {
    ...status,
    precacheApp,
    clearCache,
  }
}

/**
 * Faz precache COMPLETO da aplicacao
 * Esta funcao aguarda o SW cachear todos os assets antes de retornar
 * Chame essa funcao apos o login bem-sucedido
 */
export async function triggerPrecache(): Promise<void> {
  console.log('[Precache] Iniciando triggerPrecache...')
  console.log('[Precache] serviceWorker in navigator:', 'serviceWorker' in navigator)
  console.log('[Precache] isSecureContext:', window.isSecureContext)
  console.log('[Precache] hostname:', window.location.hostname)
  console.log('[Precache] protocol:', window.location.protocol)

  if (!('serviceWorker' in navigator)) {
    const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
    const isSecure = window.location.protocol === 'https:'
    console.log('[Precache] Service Worker nao suportado!')
    console.log('[Precache] Motivo: SW requer HTTPS ou localhost')
    console.log('[Precache] isLocalhost:', isLocalhost, '| isSecure:', isSecure)
    return
  }

  try {
    // Aguarda o SW estar pronto
    const registration = await navigator.serviceWorker.ready
    console.log('[Precache] Service Worker pronto')

    if (!registration.active) {
      console.log('[Precache] Service Worker nao ativo')
      return
    }

    // Cria uma promise que espera a resposta do SW
    const precacheComplete = new Promise<void>((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'PRECACHE_COMPLETE') {
          navigator.serviceWorker.removeEventListener('message', messageHandler)
          resolve()
        }
      }

      navigator.serviceWorker.addEventListener('message', messageHandler)

      // Timeout de seguranca - 30 segundos
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', messageHandler)
        resolve()
      }, 30000)
    })

    // Pede para o SW fazer precache
    registration.active.postMessage({ type: 'PRECACHE_APP' })
    console.log('[Precache] Solicitado ao SW...')

    // Aguarda o SW completar o precache
    await precacheComplete
    console.log('[Precache] SW reportou conclusao')

    // Faz fetch adicional das paginas principais para garantir
    // que todos os assets JS/CSS sejam carregados
    const pages = ['/', '/dashboard', '/checklist/novo', '/login', '/offline']

    console.log('[Precache] Carregando paginas para cachear assets...')

    await Promise.allSettled(
      pages.map(async (url) => {
        try {
          const response = await fetch(url)
          if (response.ok) {
            console.log('[Precache] Pagina carregada:', url)
          }
        } catch {
          // Ignora erros
        }
      })
    )

    console.log('[Precache] COMPLETO!')
  } catch (error) {
    console.error('[Precache] Erro:', error)
  }
}
