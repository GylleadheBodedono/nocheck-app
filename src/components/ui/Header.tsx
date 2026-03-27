'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FiArrowLeft, FiLogOut, FiUser, FiBell, FiSettings, FiCheck, FiAlertTriangle, FiCheckCircle, FiClock, FiTrash2, FiX, FiMenu, FiRefreshCw } from 'react-icons/fi'
import { GlobalSearch } from './GlobalSearch'
import { AdminSidebar } from './AdminSidebar'
import { APP_CONFIG } from '@/lib/config'
import { getTenantAppName, getTenantLogoUrl } from '@/lib/config'
import { ThemeToggle } from './ThemeToggle'
import { createClient } from '@/lib/supabase'
import { fullLogout } from '@/lib/logout'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { useNotifications, type AppNotification } from '@/hooks/useNotifications'
import { useTenant } from '@/hooks/useTenant'
import type { IconType } from 'react-icons'
import { BsFillHouseFill } from 'react-icons/bs'

function HeaderUpdateButton() {
  const [checking, setChecking] = useState(false)

  const checkForUpdates = async () => {
    if (checking) return
    setChecking(true)
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.update()
          await new Promise(r => setTimeout(r, 2000))
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            setTimeout(() => window.location.reload(), 1000)
            return
          }
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
      window.location.reload()
    } catch {
      window.location.reload()
    } finally {
      setChecking(false)
    }
  }

  return (
    <button
      onClick={checkForUpdates}
      disabled={checking}
      className="p-2 text-muted hover:text-primary hover:bg-surface-hover rounded-xl transition-colors"
      title="Verificar atualizacoes"
    >
      <FiRefreshCw className={`w-5 h-5 ${checking ? 'animate-spin' : ''}`} />
    </button>
  )
}

type HeaderAction = {
  label: string
  href?: string
  onClick?: () => void
  icon?: IconType
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

type HeaderProps = {
  // Navigation: back arrow (if provided) or hamburger menu
  backHref?: string
  onBack?: () => void

  // Title area (if neither title nor icon, shows logo)
  title?: string
  subtitle?: string
  icon?: IconType

  // Features
  showSearch?: boolean
  searchPlaceholder?: string
  showNotifications?: boolean
  notificationCount?: number
  showAdminLink?: boolean

  // User info (auto-fetched from Supabase/cache if not provided)
  userName?: string
  userRole?: string
  isAdmin?: boolean

  // Actions (buttons on the right side)
  actions?: HeaderAction[]
  rightSlot?: React.ReactNode
  onSignOut?: () => void

  // Progress bar or extra content below the header bar
  children?: React.ReactNode
}

/**
 * Cabeçalho universal para páginas do operador.
 * Composição flexível: suporta botão de voltar ou menu hambúrguer, título/ícone/logo,
 * busca global, notificações, link admin, dados do usuário (auto-buscados se omitidos)
 * e botões de ação customizados (`actions` ou `rightSlot`).
 *
 * Se `title` e `icon` forem omitidos, exibe o logo do OpereCheck centralizado.
 */
export function Header({
  backHref,
  onBack,
  title,
  subtitle,
  icon: Icon,
  showSearch = false,
  searchPlaceholder = 'Buscar modulos, relatorios, usuarios...',
  showNotifications = false,
  notificationCount = 0,
  showAdminLink = false,
  userName: userNameProp,
  userRole: userRoleProp,
  isAdmin: isAdminProp,
  actions = [],
  rightSlot,
  onSignOut,
  children,
}: HeaderProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Internal user state (only used when props not provided)
  const [fetchedName, setFetchedName] = useState<string | null>(null)
  const [fetchedIsAdmin, setFetchedIsAdmin] = useState(false)

  // Use props if provided, otherwise use fetched data
  const userName = userNameProp ?? fetchedName ?? ''
  const isAdmin = isAdminProp ?? fetchedIsAdmin
  const userRole = userRoleProp ?? (isAdmin ? 'Super Admin' : 'Colaborador')

  // Auto-fetch user data if not provided via props
  useEffect(() => {
    if (userNameProp !== undefined) return

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
            setFetchedName((profile as { full_name: string }).full_name || '')
            setFetchedIsAdmin((profile as { is_admin: boolean }).is_admin || false)
          }
          return
        }
      } catch {
        // Offline - try cache
      }

      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          const cachedUser = await getUserCache(cachedAuth.userId)
          if (cachedUser) {
            setFetchedName(cachedUser.full_name || '')
            setFetchedIsAdmin(cachedUser.is_admin || false)
          }
        }
      } catch {
        // Ignore
      }
    }

    fetchUser()
  }, [supabase, userNameProp])

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut()
    } else {
      await fullLogout(supabase)
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backHref) {
      router.push(backHref)
    }
  }

  const getButtonClasses = (variant: HeaderAction['variant'] = 'primary') => {
    switch (variant) {
      case 'primary': return 'btn-primary'
      case 'secondary': return 'btn-secondary'
      case 'ghost': return 'btn-ghost'
      case 'danger': return 'p-2 text-muted hover:text-error hover:bg-surface-hover rounded-xl transition-colors'
      default: return 'btn-primary'
    }
  }

  // Notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications()
  const [notifOpen, setNotifOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? (Notification.permission as 'default' | 'granted' | 'denied') : 'default'
  )
  const [notificationFeedback, setNotificationFeedback] = useState<'granted' | 'denied' | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
    }
  }, [])

  // Close dropdown on click outside
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

  // Sincronizar permissao de notificacoes do sistema ao abrir o dropdown
  useEffect(() => {
    if (notifOpen && typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission as 'default' | 'granted' | 'denied')
    }
  }, [notifOpen])

  const handleRequestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotificationPermission(result)
    setNotificationFeedback(result === 'granted' ? 'granted' : 'denied')
    setTimeout(() => setNotificationFeedback(null), 3000)
  }, [])

  const getNotifIcon = (type: string) => {
    if (type.includes('overdue') || type.includes('reincidencia')) return FiAlertTriangle
    if (type.includes('completed')) return FiCheckCircle
    if (type.includes('deadline')) return FiClock
    return FiBell
  }

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  const effectiveUnread = showNotifications ? (notificationCount || unreadCount) : 0

  // Tenant branding
  const tenant = useTenant()
  const tenantLogoUrl = getTenantLogoUrl(tenant.organization)
  const tenantAppName = getTenantAppName(tenant.organization)

  // Show logo when no title or icon is specified
  const showLogo = !title && !Icon

  return (
    <>
      <header className="fixed top-4 left-4 right-4 z-50 rounded-2xl border border-subtle shadow-theme-lg backdrop-blur-xl bg-[rgba(var(--bg-surface-rgb),0.8)]">
        <div className="mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Navigation + Title */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Admin sidebar toggle */}
              {isAdmin && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
                  title="Menu Admin"
                >
                  <FiMenu className="w-5 h-5" />
                </button>
              )}

              {/* Back arrow or Home button */}
              {backHref || onBack ? (
                <button
                  onClick={handleBack}
                  className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
                  title="Voltar"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => router.push(APP_CONFIG.routes.dashboard)}
                  className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
                  title="Dashboard"
                >
                  <BsFillHouseFill className="w-5 h-5" />
                </button>
              )}

              {/* Logo or Icon + Title */}
              {showLogo ? (
                <Link href={APP_CONFIG.routes.dashboard} className="flex items-center">
                  {tenantLogoUrl ? (
                    <img
                      src={tenantLogoUrl}
                      alt={tenantAppName}
                      className="h-8 max-w-[140px] object-contain"
                    />
                  ) : (
                    <span className="text-xl font-bold tracking-tight">
                      {tenantAppName !== APP_CONFIG.name ? (
                        <span className="text-primary">{tenantAppName}</span>
                      ) : (
                        <>
                          <span className="text-secondary">Opere</span>
                          <span className="text-primary">Check</span>
                        </>
                      )}
                    </span>
                  )}
                </Link>
              ) : (
                <>
                  {Icon && (
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="hidden sm:block">
                    <h1 className="text-sm font-bold text-main leading-tight">{title}</h1>
                    {subtitle && <p className="text-xs text-muted leading-tight">{subtitle}</p>}
                  </div>
                </>
              )}
            </div>

            {/* Center: Search bar (desktop only) */}
            {showSearch && (
              <div className="flex-1 max-w-xl hidden md:block">
                <GlobalSearch placeholder={searchPlaceholder} />
              </div>
            )}

            {/* Right: Actions + User */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Check for updates */}
              <HeaderUpdateButton />

              {/* Notifications bell */}
              {showNotifications && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors relative"
                  >
                    <FiBell className="w-5 h-5" />
                    {effectiveUnread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-warning text-[10px] text-white font-bold rounded-full flex items-center justify-center">
                        {effectiveUnread > 9 ? '9+' : effectiveUnread}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-[5.5rem] sm:top-full sm:mt-2 sm:w-96 rounded-xl border border-subtle shadow-theme-lg bg-surface z-50 overflow-hidden">
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
                              Limpar todas
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Permissao de notificacoes do sistema */}
                      {typeof window !== 'undefined' && 'Notification' in window && (notificationPermission !== 'granted' || notificationFeedback) && (
                        <div className="px-4 py-3 border-b border-subtle bg-surface-hover/50">
                          {notificationPermission === 'default' && (
                            <div className="flex flex-col gap-2">
                              <p className="text-xs text-muted">Receba avisos no celular como notificacao do sistema.</p>
                              <button
                                type="button"
                                onClick={handleRequestNotificationPermission}
                                className="btn-primary text-xs w-full py-2"
                              >
                                Ativar notificacoes
                              </button>
                            </div>
                          )}
                          {notificationPermission === 'denied' && (
                            <p className="text-xs text-muted">Notificacoes bloqueadas. Ative nas configuracoes do navegador.</p>
                          )}
                          {notificationFeedback === 'granted' && (
                            <p className="text-xs text-success font-medium">Notificacoes ativadas.</p>
                          )}
                          {notificationFeedback === 'denied' && (
                            <p className="text-xs text-error">Permissao negada. Ative depois nas configuracoes.</p>
                          )}
                        </div>
                      )}

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
                              <Link
                                key={notif.id}
                                href={notif.link || '#'}
                                onClick={() => {
                                  if (!notif.is_read) markAsRead(notif.id)
                                  setNotifOpen(false)
                                }}
                                className={`group flex items-start gap-3 px-4 py-3 hover:bg-surface-hover transition-colors border-b border-subtle last:border-b-0 ${
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
                                <button
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    deleteNotification(notif.id)
                                  }}
                                  className="shrink-0 p-1 text-muted hover:text-error rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                                  title="Excluir notificacao"
                                >
                                  <FiX className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Admin Link (settings gear) */}
              {showAdminLink && isAdmin && (
                <Link
                  href={APP_CONFIG.routes.admin}
                  className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
                  title="Painel Admin"
                >
                  <FiSettings className="w-5 h-5" />
                </Link>
              )}

              {/* Custom action buttons */}
              {actions.map((action, index) => {
                const ActionIcon = action.icon
                if (action.href) {
                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className={`${getButtonClasses(action.variant)} flex items-center gap-2`}
                    >
                      {ActionIcon && <ActionIcon className="w-4 h-4" />}
                      <span className="hidden sm:inline">{action.label}</span>
                    </Link>
                  )
                }
                return (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`${getButtonClasses(action.variant)} flex items-center gap-2`}
                  >
                    {ActionIcon && <ActionIcon className="w-4 h-4" />}
                    <span className="hidden sm:inline">{action.label}</span>
                  </button>
                )
              })}

              {/* Custom right-side content */}
              {rightSlot}

              {/* User Info */}
              {userName && (
                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-subtle">
                  <div className="text-right">
                    <p className="text-xs font-medium text-main leading-tight">{userName}</p>
                    <p className="text-[10px] text-muted leading-tight">{userRole}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <FiUser className="w-4 h-4 text-primary" />
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
          </div>
        </div>

        {/* Extra content below header (progress bar, etc.) */}
        {children}
      </header>
      {/* Spacer for fixed header */}
      <div className="h-24" />

      {/* Admin sidebar drawer */}
      {isAdmin && <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
    </>
  )
}
