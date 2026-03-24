'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Hook genérico de Realtime do Supabase: se inscreve em mudanças de uma ou mais
 * tabelas e retorna um `refreshKey` que incrementa a cada mudança detectada.
 *
 * Uso em qualquer página:
 * ```tsx
 * const { refreshKey } = useRealtimeRefresh(['action_plans', 'notifications'])
 * useEffect(() => { if (refreshKey > 0) loadData() }, [refreshKey])
 * ```
 *
 * - Cria um canal Supabase por tabela (com sufixo aleatório para evitar colisão)
 * - Só ativo quando `navigator.onLine === true`
 * - Cleanup automático no unmount e ao trocar a lista de tabelas
 * - Não afeta funcionalidade offline
 *
 * @param tables - Lista de nomes de tabelas para monitorar (ex: `['checklists', 'action_plans']`)
 * @returns `{ refreshKey }` — número que incrementa a cada evento recebido
 */
export function useRealtimeRefresh(tables: string[]) {
  const [refreshKey, setRefreshKey] = useState(0)
  const channelsRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']>[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (tables.length === 0) return

    const supabase = createClient()

    // Criar um canal por tabela
    const channels = tables.map(table => {
      const channel = supabase
        .channel(`realtime-${table}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes' as 'system',
          { event: '*', schema: 'public', table },
          () => {
            setRefreshKey(prev => prev + 1)
          }
        )
        .subscribe()
      return channel
    })

    channelsRef.current = channels

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')])

  return { refreshKey }
}
