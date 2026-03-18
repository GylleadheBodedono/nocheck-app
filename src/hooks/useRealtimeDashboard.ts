'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'

type UseRealtimeDashboardParams = {
  userId: string | null
  userFunctionId: number | null
  storeIds: number[]
}

export function useRealtimeDashboard({ userId, userFunctionId, storeIds }: UseRealtimeDashboardParams) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const supabase = useMemo(() => createClient(), [])
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([])

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  useEffect(() => {
    if (!userId) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    const channels: ReturnType<typeof supabase.channel>[] = []

    // 1. Notifications channel
    const notifChannel = supabase
      .channel(`dashboard:notifications:${userId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        } as Record<string, unknown>,
        triggerRefresh as unknown as (payload: Record<string, unknown>) => void
      )
      .subscribe()

    channels.push(notifChannel)

    // 2. Action plans channel (assigned_to)
    const apChannel = supabase
      .channel(`dashboard:action_plans:${userId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'action_plans',
          filter: `assigned_to=eq.${userId}`,
        } as Record<string, unknown>,
        triggerRefresh as unknown as (payload: Record<string, unknown>) => void
      )
      .on(
        'postgres_changes' as 'system',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'action_plans',
          filter: `assigned_to=eq.${userId}`,
        } as Record<string, unknown>,
        triggerRefresh as unknown as (payload: Record<string, unknown>) => void
      )
      .subscribe()

    channels.push(apChannel)

    // 3. Action plans by function (if set)
    if (userFunctionId) {
      const apFnChannel = supabase
        .channel(`dashboard:action_plans_fn:${userFunctionId}`)
        .on(
          'postgres_changes' as 'system',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'action_plans',
            filter: `assigned_function_id=eq.${userFunctionId}`,
          } as Record<string, unknown>,
          triggerRefresh as unknown as (payload: Record<string, unknown>) => void
        )
        .on(
          'postgres_changes' as 'system',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'action_plans',
            filter: `assigned_function_id=eq.${userFunctionId}`,
          } as Record<string, unknown>,
          triggerRefresh as unknown as (payload: Record<string, unknown>) => void
        )
        .subscribe()

      channels.push(apFnChannel)
    }

    // 4. Checklists channel (one per store)
    for (const storeId of storeIds) {
      const clChannel = supabase
        .channel(`dashboard:checklists:store_${storeId}`)
        .on(
          'postgres_changes' as 'system',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'checklists',
            filter: `store_id=eq.${storeId}`,
          } as Record<string, unknown>,
          triggerRefresh as unknown as (payload: Record<string, unknown>) => void
        )
        .on(
          'postgres_changes' as 'system',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'checklists',
            filter: `store_id=eq.${storeId}`,
          } as Record<string, unknown>,
          triggerRefresh as unknown as (payload: Record<string, unknown>) => void
        )
        .subscribe()

      channels.push(clChannel)
    }

    channelsRef.current = channels

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch))
      channelsRef.current = []
    }
  }, [userId, userFunctionId, storeIds, supabase, triggerRefresh])

  return { refreshTrigger }
}
