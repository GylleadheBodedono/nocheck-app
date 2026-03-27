'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getAuthCache } from '@/lib/offlineCache'
import { logError } from '@/lib/clientLogger'

/** Notificação in-app retornada pela tabela `notifications` do Supabase. */
export type AppNotification = {
  id: number
  user_id: string
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

/**
 * Hook para gerenciar notificações in-app do usuário autenticado.
 *
 * - Inicializa buscando as últimas 20 notificações do Supabase (ou do cache em modo offline)
 * - Assina INSERT em tempo real via canal Supabase filtrado por `user_id`
 * - Em INSERT: exibe notificação do navegador se a permissão estiver concedida
 *   (prefere o Service Worker; usa `new Notification` como fallback)
 *
 * @returns `{ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications }`
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Fetch initial notifications
  const fetchNotifications = useCallback(async (uid: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data) {
        setNotifications(data as AppNotification[])
        setUnreadCount((data as AppNotification[]).filter(n => !n.is_read).length)
      }
    } catch (err) {
      logError('[useNotifications] Erro ao buscar notificacoes', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [supabase])

  // Initialize: get user ID and fetch
  useEffect(() => {
    const init = async () => {
      let uid: string | null = null

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) uid = user.id
      } catch {
        // Offline
      }

      if (!uid) {
        try {
          const cached = await getAuthCache()
          if (cached) uid = cached.userId
        } catch {
          // No cache
        }
      }

      if (uid) {
        setUserId(uid)
        await fetchNotifications(uid)
      }
    }

    init()
  }, [supabase, fetchNotifications])

  // Setup realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        } as Record<string, unknown>,
        (payload: { new: AppNotification }) => {
          const newNotification = payload.new as AppNotification
          setNotifications(prev => [newNotification, ...prev].slice(0, 20))
          setUnreadCount(prev => prev + 1)

          // Notificacao do sistema (celular/navegador) quando permissao concedida
          if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return
          const title = newNotification.title || 'OpereCheck'
          const body = newNotification.message || ''
          const link = newNotification.link || '/dashboard'
          const id = newNotification.id
          const payloadMsg = { title, body, link, id }
          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', payload: payloadMsg })
          } else {
            const n = new Notification(title, {
              body,
              icon: '/web-app-manifest-192x192.png',
              tag: 'operecheck-' + id,
              data: { url: link.startsWith('http') ? link : window.location.origin + (link.startsWith('/') ? link : '/' + link) },
            })
            n.onclick = () => {
              window.focus()
              window.location.href = link.startsWith('http') ? link : (window.location.origin + (link.startsWith('/') ? link : '/' + link))
            }
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      logError('[useNotifications] Erro ao marcar como lida', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [supabase])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      logError('[useNotifications] Erro ao marcar todas como lidas', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [supabase, userId])

  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('notifications')
        .delete()
        .eq('id', notificationId)

      setNotifications(prev => {
        const target = prev.find(n => n.id === notificationId)
        if (target && !target.is_read) {
          setUnreadCount(c => Math.max(0, c - 1))
        }
        return prev.filter(n => n.id !== notificationId)
      })
    } catch (err) {
      logError('[useNotifications] Erro ao excluir notificacao', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [supabase])

  const deleteAllNotifications = useCallback(async () => {
    if (!userId) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('notifications')
        .delete()
        .eq('user_id', userId)

      setNotifications([])
      setUnreadCount(0)
    } catch (err) {
      logError('[useNotifications] Erro ao excluir todas notificacoes', { error: err instanceof Error ? err.message : String(err) })
    }
  }, [supabase, userId])

  return { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications }
}
