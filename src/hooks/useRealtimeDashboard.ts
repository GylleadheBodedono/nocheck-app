'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

/** Parâmetros de filtro para as assinaturas Realtime do dashboard. */
type UseRealtimeDashboardParams = {
  userId: string | null
  userFunctionId: number | null
  storeIds: number[]
}

/**
 * Hook de Realtime específico para o dashboard.
 * Cria até N+3 canais Supabase (1 para notificações, 1 para planos do usuário,
 * 1 opcional por função e 1 por loja) e retorna um `refreshTrigger` que
 * incrementa quando qualquer evento é recebido em qualquer canal.
 *
 * - Inativo enquanto `userId` for `null` ou o dispositivo estiver offline
 * - Cleanup automático no unmount
 *
 * @returns `{ refreshTrigger }` — número que incrementa a cada evento Realtime
 */
export function useRealtimeDashboard({ userId, userFunctionId, storeIds }: UseRealtimeDashboardParams) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])
  const triggerRefresh = useCallback(() => setRefreshTrigger(prev => prev + 1), [])

  useEffect(() => {
    if (!userId || (typeof navigator !== 'undefined' && !navigator.onLine)) return
    const channels: ReturnType<typeof supabase.channel>[] = []

    // Notifications
    channels.push(supabase.channel(`dash:notif:${userId}`)
      .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` } as Record<string, unknown>, triggerRefresh as unknown as (p: Record<string, unknown>) => void)
      .subscribe())

    // Action plans (direct + by function)
    channels.push(supabase.channel(`dash:ap:${userId}`)
      .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'action_plans', filter: `assigned_to=eq.${userId}` } as Record<string, unknown>, triggerRefresh as unknown as (p: Record<string, unknown>) => void)
      .subscribe())

    if (userFunctionId) {
      channels.push(supabase.channel(`dash:apfn:${userFunctionId}`)
        .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'action_plans', filter: `assigned_function_id=eq.${userFunctionId}` } as Record<string, unknown>, triggerRefresh as unknown as (p: Record<string, unknown>) => void)
        .subscribe())
    }

    // Checklists per store
    for (const storeId of storeIds) {
      channels.push(supabase.channel(`dash:cl:${storeId}`)
        .on('postgres_changes' as 'system', { event: '*', schema: 'public', table: 'checklists', filter: `store_id=eq.${storeId}` } as Record<string, unknown>, triggerRefresh as unknown as (p: Record<string, unknown>) => void)
        .subscribe())
    }

    channelsRef.current = channels
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); channelsRef.current = [] }
  }, [userId, userFunctionId, storeIds, supabase, triggerRefresh])

  return { refreshTrigger }
}
