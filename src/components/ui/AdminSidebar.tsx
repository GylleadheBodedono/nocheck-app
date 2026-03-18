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
  FiCreditCard,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

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

const routes = APP_CONFIG.routes

const SIDEBAR_ITEMS: SidebarItem[] = [
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
  { label: 'Configuracoes', href: routes.adminSettings, icon: FiSettings },
  { label: 'Faturamento', href: '/admin/configuracoes/billing', icon: FiCreditCard },
]

type AdminSidebarProps = {
  isOpen: boolean
  onClose: () => void
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Auto-expand section that matches current path
  useEffect(() => {
    for (const item of SIDEBAR_ITEMS) {
      if (item.children) {
        const isChildActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
        if (isChildActive) {
          setExpanded(prev => new Set(prev).add(item.label))
        }
      }
    }
  }, [pathname])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <nav className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-subtle shadow-2xl flex flex-col animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
          <Link href={routes.admin} onClick={onClose} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <FiGrid className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-main leading-tight">{APP_CONFIG.name}</p>
              <p className="text-[10px] text-muted leading-tight">Administracao</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const hasChildren = item.children && item.children.length > 0
            const isExpanded = expanded.has(item.label)

            return (
              <div key={item.label}>
                {hasChildren ? (
                  // Parent with children — button to expand
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-secondary hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <FiChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  // Simple link
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-secondary hover:text-main hover:bg-surface-hover'
                    }`}
                  >
                    <Icon className="w-4.5 h-4.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )}

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div className="ml-7 mt-0.5 space-y-0.5 border-l-2 border-subtle pl-3">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onClose}
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

        {/* Footer */}
        <div className="px-5 py-3 border-t border-subtle">
          <Link
            href={routes.dashboard}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-main hover:bg-surface-hover transition-colors"
          >
            <FiHome className="w-4.5 h-4.5" />
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
  )
}
