'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import {
  FiX,
  FiUsers,
  FiClipboard,
  FiHome,
  FiBarChart2,
  FiSettings,
  FiGrid,
  FiImage,
  FiSliders,
  FiFileText,
  FiBookmark,
  FiCheckCircle,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiTerminal,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

// ------------------------------------
// TYPES
// ------------------------------------

type SidebarChild = {
  label: string
  href: string
}

type SidebarItem = {
  label: string
  href: string
  icon: IconType
  children?: SidebarChild[]
}

// ------------------------------------
// MENU ITEMS (same as AdminSidebar)
// ------------------------------------

const routes = APP_CONFIG.routes

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: routes.dashboard, icon: FiHome },
  { label: 'Painel Admin', href: routes.admin, icon: FiGrid },
  {
    label: 'Usuarios',
    href: routes.adminUsers,
    icon: FiUsers,
  },
  {
    label: 'Checklists',
    href: routes.adminTemplates,
    icon: FiClipboard,
    children: [
      { label: 'Modelos', href: routes.adminTemplates },
      { label: 'Respostas', href: routes.adminChecklists },
    ],
  },
  { label: 'Lojas', href: routes.adminStores, icon: FiHome },
  { label: 'Setores', href: routes.adminSectors, icon: FiBookmark },
  { label: 'Funcoes', href: routes.adminFunctions, icon: FiSliders },
  { label: 'Validacoes', href: routes.adminValidations, icon: FiCheckCircle },
  {
    label: 'Planos de Acao',
    href: routes.adminActionPlans,
    icon: FiFileText,
    children: [
      { label: 'Todos os Planos', href: routes.adminActionPlans },
      { label: 'Modelos de Plano', href: routes.adminActionPlanPresets },
    ],
  },
  {
    label: 'Relatorios',
    href: routes.adminReports,
    icon: FiBarChart2,
    children: [
      { label: 'Visao Geral', href: routes.adminReports },
      { label: 'Fotos NC', href: routes.adminNCPhotoReport },
      { label: 'Planos de Acao', href: routes.adminActionPlanReport },
    ],
  },
  { label: 'Galeria', href: routes.adminGallery, icon: FiImage },
  { label: 'Logs', href: routes.adminLogs, icon: FiTerminal },
  {
    label: 'Configuracoes',
    href: routes.adminSettings,
    icon: FiSettings,
    children: [
      { label: 'Email / Geral', href: routes.adminSettings },
      { label: 'Equipe', href: routes.adminSettings + '/equipe' },
      { label: 'Billing', href: routes.adminSettings + '/billing' },
    ],
  },
]

// ------------------------------------
// COMPONENT
// ------------------------------------

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
  variant?: 'admin' | 'employee' // mantido para compat, ignorado
}

/**
 * Sidebar de navegação permanente do painel do operador.
 * Suporta dois estados: expandido e colapsado (somente ícones).
 * Em mobile, exibe como drawer sobreposto controlado por `mobileOpen`.
 * Auto-expande o grupo de links correspondente à rota atual.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PermanentSidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose, variant }: Props) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const items = SIDEBAR_ITEMS

  // Auto-expand section that matches current path
  useEffect(() => {
    for (const item of items) {
      if (item.children) {
        const isChildActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (isChildActive) {
          setExpanded(prev => new Set(prev).add(item.label))
        }
      }
    }
  }, [pathname])

  // Close mobile on Escape
  useEffect(() => {
    if (!mobileOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobileOpen, onMobileClose])

  // Prevent body scroll when mobile open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const toggleExpand = useCallback((label: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }, [])

  const isActive = (href: string) => {
    if (href === routes.admin) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  // ------------------------------------
  // NAV CONTENT (shared between desktop & mobile)
  // ------------------------------------

  const renderNavItems = (isMobile: boolean) => (
    <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item.href)
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expanded.has(item.label)
        const showText = isMobile || !collapsed

        return (
          <div key={item.label}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => {
                  if (collapsed && !isMobile) {
                    // If collapsed, expand sidebar first, then expand group
                    onToggleCollapse()
                    setExpanded(prev => new Set(prev).add(item.label))
                  } else {
                    toggleExpand(item.label)
                  }
                }}
                title={collapsed && !isMobile ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-secondary hover:text-main hover:bg-surface-hover'
                } ${!showText ? 'justify-center' : ''}`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {showText && <span className="flex-1 text-left truncate">{item.label}</span>}
                {showText && (
                  <FiChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </button>
            ) : (
              <Link
                href={item.href}
                onClick={isMobile ? onMobileClose : undefined}
                title={collapsed && !isMobile ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-secondary hover:text-main hover:bg-surface-hover'
                } ${!showText ? 'justify-center' : ''}`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {showText && <span className="truncate">{item.label}</span>}
              </Link>
            )}

            {/* Children */}
            {hasChildren && isExpanded && showText && (
              <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 border-subtle pl-3">
                {item.children!.map((child) => {
                  const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={isMobile ? onMobileClose : undefined}
                      className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                        childActive
                          ? 'text-primary font-semibold bg-primary/5'
                          : 'text-muted hover:text-main hover:bg-surface-hover'
                      }`}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // ------------------------------------
  // DESKTOP SIDEBAR
  // ------------------------------------

  const desktopSidebar = (
    <nav
      className="hidden lg:flex flex-col h-full bg-surface border-r border-subtle transition-all duration-200 shrink-0"
      style={{ width: collapsed ? 68 : 230 }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-subtle shrink-0" style={{ minHeight: 56 }}>
        <Link href={routes.admin} className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <FiGrid className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-main leading-tight truncate">{APP_CONFIG.name}</p>
              <p className="text-[10px] text-muted leading-tight">Administracao</p>
            </div>
          )}
        </Link>
      </div>

      {/* Nav items */}
      {renderNavItems(false)}

      {/* Footer */}
      <div className="px-3 py-3 border-t border-subtle space-y-0.5 shrink-0">
        <Link
          href={routes.dashboard}
          title={collapsed ? 'Voltar ao Dashboard' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-main hover:bg-surface-hover transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <FiHome className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span className="truncate">Voltar ao Dashboard</span>}
        </Link>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-main hover:bg-surface-hover transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <FiChevronRight className="w-[18px] h-[18px] shrink-0" />
          ) : (
            <>
              <FiChevronLeft className="w-[18px] h-[18px] shrink-0" />
              <span className="truncate">Recolher</span>
            </>
          )}
        </button>
      </div>
    </nav>
  )

  // ------------------------------------
  // MOBILE DRAWER
  // ------------------------------------

  const mobileDrawer = mobileOpen ? (
    <div className="fixed inset-0 z-[60] lg:hidden">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onMobileClose}
      />

      {/* Panel */}
      <nav className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-subtle shadow-2xl flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
          <Link href={routes.admin} onClick={onMobileClose} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <FiGrid className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-main leading-tight">{APP_CONFIG.name}</p>
              <p className="text-[10px] text-muted leading-tight">Administracao</p>
            </div>
          </Link>
          <button
            onClick={onMobileClose}
            className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        {renderNavItems(true)}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-subtle">
          <Link
            href={routes.dashboard}
            onClick={onMobileClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-main hover:bg-surface-hover transition-colors"
          >
            <FiHome className="w-[18px] h-[18px]" />
            <span>Voltar ao Dashboard</span>
          </Link>
        </div>
      </nav>

      <style jsx>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.2s ease-out;
        }
      `}</style>
    </div>
  ) : null

  return (
    <>
      {desktopSidebar}
      {mobileDrawer}
    </>
  )
}
