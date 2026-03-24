'use client'

import { useEffect } from 'react'
import { initClientLogger } from '@/lib/clientLogger'

/**
 * Componente invisível que inicializa o `clientLogger` no client-side.
 * Deve ser montado uma única vez no layout raiz (`app/layout.tsx`).
 * Retorna `null` — sem renderização visual.
 */
export function ClientLoggerInit() {
  useEffect(() => {
    initClientLogger()
  }, [])
  return null
}
