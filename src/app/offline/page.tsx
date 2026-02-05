'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FiWifiOff, FiRefreshCw, FiCheckCircle, FiHome } from 'react-icons/fi'
import { hasCachedData } from '@/lib/offlineCache'
import { APP_CONFIG } from '@/lib/config'

export default function OfflinePage() {
  const [hasCached, setHasCached] = useState<boolean | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Verifica se tem dados cacheados
    const checkCache = async () => {
      const hasData = await hasCachedData()
      setHasCached(hasData)
    }
    checkCache()

    // Monitora conexao
    const handleOnline = () => {
      setIsOnline(true)
      // Recarrega apos 1 segundo quando volta online
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }

    setIsOnline(navigator.onLine)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const handleRetry = () => {
    window.location.reload()
  }

  const handleGoToDashboard = () => {
    router.push(APP_CONFIG.routes.dashboard)
  }

  // Se voltou online, mostra mensagem de reconexao
  if (isOnline) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="w-12 h-12 text-success" />
          </div>

          <h1 className="text-2xl font-bold text-main mb-2">
            Conexao restaurada!
          </h1>

          <p className="text-muted mb-6">
            Recarregando a pagina...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-6">
          <FiWifiOff className="w-12 h-12 text-warning" />
        </div>

        <h1 className="text-2xl font-bold text-main mb-2">
          Voce esta offline
        </h1>

        {hasCached ? (
          <>
            <p className="text-muted mb-6">
              Sem conexao com a internet, mas voce pode continuar usando o app com os dados salvos no seu dispositivo.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoToDashboard}
                className="btn-primary flex items-center justify-center gap-2 px-6 py-3"
              >
                <FiHome className="w-5 h-5" />
                Continuar offline
              </button>

              <button
                onClick={handleRetry}
                className="btn-secondary flex items-center justify-center gap-2 px-6 py-3"
              >
                <FiRefreshCw className="w-5 h-5" />
                Verificar conexao
              </button>
            </div>

            <div className="mt-8 p-4 bg-success/10 rounded-xl border border-success/20">
              <p className="text-sm text-success">
                <FiCheckCircle className="inline w-4 h-4 mr-1" />
                Dados salvos! Voce pode preencher checklists offline.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="text-muted mb-6">
              Voce precisa de conexao com a internet para fazer login pela primeira vez. Apos isso, podera usar o app offline.
            </p>

            <button
              onClick={handleRetry}
              className="btn-primary flex items-center justify-center gap-2 mx-auto px-6 py-3"
            >
              <FiRefreshCw className="w-5 h-5" />
              Tentar novamente
            </button>
          </>
        )}

        <p className="text-xs text-muted mt-8">
          Checklists preenchidos offline serao sincronizados automaticamente quando a conexao for restaurada.
        </p>
      </div>
    </div>
  )
}
