'use client'

import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto">
          <FiAlertTriangle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-lg font-bold text-main">Algo deu errado</h2>
        <p className="text-sm text-muted">{error.message || 'Erro inesperado na area administrativa.'}</p>
        <button onClick={reset} className="btn-primary flex items-center gap-2 mx-auto">
          <FiRefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    </div>
  )
}
