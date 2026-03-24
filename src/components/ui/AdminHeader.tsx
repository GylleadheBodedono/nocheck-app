'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { FiBell, FiLogOut, FiUser, FiCheck, FiTrash2, FiX, FiAlertTriangle, FiCheckCircle, FiClock } from 'react-icons/fi'
import { GlobalSearch } from '@/components/ui/GlobalSearch'
import { ThemeToggle } from '@/components/ui'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { APP_CONFIG } from '@/lib/config'
import { createClient } from '@/lib/supabase'
import { fullLogout } from '@/lib/logout'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'

// ------------------------------------
// TITLES MAP
// ------------------------------------

const TITLES: Record<string, string> = {
  '/admin': 'Painel Admin',
  '/admin/checklists': 'Checklists',
  '/admin/lojas': 'Lojas',
  '/admin/usuarios': 'Usuarios',
  '/admin/usuarios/novo': 'Novo Usuario',
  '/admin/templates': 'Templates',
  '/admin/templates/novo': 'Novo Template',
  '/admin/setores': 'Setores',
  '/admin/funcoes': 'Funcoes',
  '/admin/validacoes': 'Validacoes',
  '/admin/galeria': 'Galeria',
  '/admin/configuracoes': 'Configuracoes',
  '/admin/relatorios': 'Relatorios',
  '/admin/relatorios/fotos-nc': 'Fotos NC',
  '/admin/relatorios/planos-de-acao': 'Relatorio Planos',
  '/admin/planos-de-acao': 'Planos de Acao',
  '/admin/planos-de-acao/novo': 'Novo Plano',
  '/admin/planos-de-acao/modelos': 'Modelos',
}

function resolveTitle(pathname: string): string {
  // Exact match first
  if (TITLES[pathname]) return TITLES[pathname]
  // Longest prefix match for dynamic routes (e.g. /admin/usuarios/[id])
  const segments = pathname.split('/')
  for (let i = segments.length - 1; i >= 2; i--) {
    const partial = segments.slice(0, i).join('/')
    if (TITLES[partial]) return TITLES[partial]
  }
  return 'Admin'
}

// ------------------------------------
// HELPERS
// ------------------------------------

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function getNotifIcon(type: string) {
  if (type.includes('overdue') || type.includes('reincidencia')) return FiAlertTriangle
  if (type.includes('completed')) return FiCheckCircle
  if (type.includes('deadline')) return FiClock
  return FiBell
}

// ------------------------------------
// COMPONENT
// ------------------------------------

type Props = {
  children?: React.ReactNode
}

/**
 * Cabeçalho fixo do painel administrativo.
 * Exibe o título da página atual (mapeado por rota), busca global, sino de notificações
 * com badge de não lidas, menu do usuário e botão de logout.
 */
export function AdminHeader({ children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const title = resolveTitle(pathname)

  // User data
  const [userName, setUserName] = useState('')
  const [userInitials, setUserInitials] = useState('')

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('full_name, is_admin')
            .eq('id', user.id)
            .single()
          if (profile) {
            const name = (profile as { full_name: string }).full_name || ''
            setUserName(name)
            setUserInitials(getInitials(name))
          }
        }
      } catch {
        // Offline — ignore
      }
    }
    fetchUser()
  }, [supabase])

  // Notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setNotifOpen(false)
    }
  }, [])

  useEffect(() => {
    if (notifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, handleClickOutside])

  const handleSignOut = async () => {
    await fullLogout(supabase)
  }

  return (
    <header className="bg-surface border-b border-subtle px-6 py-3 flex items-center justify-between gap-4 shrink-0" style={{ minHeight: 56 }}>
      {/* Left: mobile menu button (from children) + title */}
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <h1 className="text-sm font-semibold text-main">{title}</h1>
      </div>

      {/* Center: GlobalSearch (desktop only) */}
      <div className="flex-1 max-w-xl hidden md:block">
        <GlobalSearch placeholder="Buscar modulos, relatorios, usuarios..." />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors relative"
            title="Notificacoes"
          >
            <FiBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-warning text-[10px] text-white font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full sm:mt-2 sm:w-96 rounded-xl border border-subtle shadow-theme-lg bg-surface z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
                <h3 className="text-sm font-semibold text-main">Notificacoes</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllAsRead()}
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                    >
                      <FiCheck className="w-3 h-3" />
                      Marcar lidas
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={() => deleteAllNotifications()}
                      className="text-xs text-error hover:text-error/80 flex items-center gap-1 transition-colors"
                    >
                      <FiTrash2 className="w-3 h-3" />
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <FiBell className="w-8 h-8 text-muted mx-auto mb-2" />
                    <p className="text-sm text-muted">Nenhuma notificacao</p>
                  </div>
                ) : (
                  notifications.map((notif: AppNotification) => {
                    const NotifIcon = getNotifIcon(notif.type)
                    return (
                      <button
                        key={notif.id}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id)
                          setNotifOpen(false)
                          if (notif.link) router.push(notif.link)
                        }}
                        className={`group w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors border-b border-subtle last:border-b-0 text-left ${
                          !notif.is_read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.type.includes('overdue') || notif.type.includes('reincidencia')
                            ? 'bg-error/20'
                            : notif.type.includes('completed')
                            ? 'bg-success/20'
                            : 'bg-primary/10'
                        }`}>
                          <NotifIcon className={`w-4 h-4 ${
                            notif.type.includes('overdue') || notif.type.includes('reincidencia')
                              ? 'text-error'
                              : notif.type.includes('completed')
                              ? 'text-success'
                              : 'text-primary'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-tight ${!notif.is_read ? 'font-semibold text-main' : 'text-secondary'}`}>
                            {notif.title}
                          </p>
                          {notif.message && (
                            <p className="text-xs text-muted mt-0.5 line-clamp-2">{notif.message}</p>
                          )}
                          <p className="text-xs text-muted mt-1">{formatTimeAgo(notif.created_at)}</p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            deleteNotification(notif.id)
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); deleteNotification(notif.id) } }}
                          className="shrink-0 p-1 text-muted hover:text-error rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                          title="Excluir notificacao"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Info */}
        {userName && (
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-subtle">
            <div className="text-right">
              <p className="text-xs font-medium text-main leading-tight">{userName}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {userInitials || <FiUser className="w-4 h-4" />}
            </div>
          </div>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="p-2 text-muted hover:text-error hover:bg-surface-hover rounded-xl transition-colors"
          title="Sair"
        >
          <FiLogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
