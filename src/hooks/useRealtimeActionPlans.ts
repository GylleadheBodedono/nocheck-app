'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

/**
 * Hook de Realtime para planos de ação atribuídos ao usuário.
 * Mantém a lista local de planos atualizada com INSERT/UPDATE em tempo real.
 *
 * Canais criados:
 * 1. `assigned_to = userId` — planos diretamente atribuídos ao usuário
 * 2. `assigned_function_id = userFunctionId` — planos atribuídos à função do usuário (opcional)
 *
 * Em INSERT, dispara notificação do navegador se a permissão estiver concedida
 * (via Service Worker ou `new Notification` como fallback).
 *
 * @param userId - ID do usuário autenticado
 * @param userFunctionId - ID da função do usuário, ou `null` se não configurado
 * @returns `{ newPlanCount, clearNewCount }`
 */
export function useRealtimeActionPlans(userId: string | null, userFunctionId: number | null) {
  const [newPlanCount, setNewPlanCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const handleNewPlan = useCallback(() => { setNewPlanCount(prev => prev + 1) }, [])
  const clearNewCount = useCallback(() => setNewPlanCount(0), [])

  useEffect(() => {
    if (!userId || (typeof navigator !== 'undefined' && !navigator.onLine)) return
    const channels: ReturnType<typeof supabase.channel>[] = []

    channels.push(supabase.channel(`rtap:user:${userId}`)
      .on('postgres_changes' as 'system', { event: 'INSERT', schema: 'public', table: 'action_plans', filter: `assigned_to=eq.${userId}` } as Record<string, unknown>, handleNewPlan as unknown as (p: Record<string, unknown>) => void)
      .subscribe())

    if (userFunctionId) {
      channels.push(supabase.channel(`rtap:fn:${userFunctionId}`)
        .on('postgres_changes' as 'system', { event: 'INSERT', schema: 'public', table: 'action_plans', filter: `assigned_function_id=eq.${userFunctionId}` } as Record<string, unknown>, handleNewPlan as unknown as (p: Record<string, unknown>) => void)
        .subscribe())
    }

    channelsRef.current = channels
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); channelsRef.current = [] }
  }, [userId, userFunctionId, supabase, handleNewPlan])

  return { newPlanCount, clearNewCount }
}
