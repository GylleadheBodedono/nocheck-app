'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { ActionPlan } from '@/types/database'

type RealtimeActionPlan = ActionPlan

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
 * @returns `{ actionPlans, newPlanCount, clearNewCount }`
 */
export function useRealtimeActionPlans(userId: string, userFunctionId: number | null) {
  const [actionPlans, setActionPlans] = useState<RealtimeActionPlan[]>([])
  const [newPlanCount, setNewPlanCount] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const clearNewCount = useCallback(() => {
    setNewPlanCount(0)
  }, [])

  // Handle incoming INSERT
  const handleInsert = useCallback((payload: { new: RealtimeActionPlan }) => {
    const newPlan = payload.new as RealtimeActionPlan
    setActionPlans(prev => {
      // Avoid duplicates
      if (prev.some(p => p.id === newPlan.id)) return prev
      return [newPlan, ...prev]
    })
    setNewPlanCount(prev => prev + 1)

    // Optional browser notification
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const title = 'Novo Plano de Acao'
      const body = newPlan.title || 'Um plano de acao foi atribuido a voce'
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: { title, body, link: `/action-plans/${newPlan.id}`, id: newPlan.id },
        })
      } else {
        new Notification(title, {
          body,
          icon: '/web-app-manifest-192x192.png',
          tag: 'operecheck-ap-' + newPlan.id,
        })
      }
    }
  }, [])

  // Handle incoming UPDATE
  const handleUpdate = useCallback((payload: { new: RealtimeActionPlan }) => {
    const updated = payload.new as RealtimeActionPlan
    setActionPlans(prev =>
      prev.map(p => (p.id === updated.id ? updated : p))
    )
  }, [])

  // Setup realtime subscriptions
  useEffect(() => {
    if (!userId) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    const channels: ReturnType<typeof supabase.channel>[] = []

    // Channel 1: assigned_to = userId (INSERT + UPDATE)
    const ch1 = supabase
      .channel(`action_plans:assigned_to:${userId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'action_plans',
          filter: `assigned_to=eq.${userId}`,
        } as Record<string, unknown>,
        handleInsert as (payload: Record<string, unknown>) => void
      )
      .on(
        'postgres_changes' as 'system',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'action_plans',
          filter: `assigned_to=eq.${userId}`,
        } as Record<string, unknown>,
        handleUpdate as (payload: Record<string, unknown>) => void
      )
      .subscribe()

    channels.push(ch1)

    // Channel 2: assigned_function_id = userFunctionId (only if set)
    if (userFunctionId) {
      const ch2 = supabase
        .channel(`action_plans:assigned_fn:${userFunctionId}`)
        .on(
          'postgres_changes' as 'system',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'action_plans',
            filter: `assigned_function_id=eq.${userFunctionId}`,
          } as Record<string, unknown>,
          handleInsert as (payload: Record<string, unknown>) => void
        )
        .on(
          'postgres_changes' as 'system',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'action_plans',
            filter: `assigned_function_id=eq.${userFunctionId}`,
          } as Record<string, unknown>,
          handleUpdate as (payload: Record<string, unknown>) => void
        )
        .subscribe()

      channels.push(ch2)
    }

    channelsRef.current = channels

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []
    }
  }, [userId, userFunctionId, supabase, handleInsert, handleUpdate])

  return { actionPlans, newPlanCount, clearNewCount }
}
