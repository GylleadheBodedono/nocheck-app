'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FiHome, FiUsers, FiSettings, FiX, FiLogOut, FiHelpCircle, FiZap } from 'react-icons/fi'
import { createClient } from '@/lib/supabase'

const MAIN_MENU = [
  { href: '/platform', label: 'Overview', icon: FiHome },
  { href: '/platform/clientes', label: 'Clientes', icon: FiUsers },
]

const GENERAL_MENU = [
  { href: '/platform/configuracoes', label: 'Configurações', icon: FiSettings },
  { href: '/platform', label: 'Suporte', icon: FiHelpCircle },
]

interface Props {
  isOpen: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapse: () => void
}

export function PlatformSidebar({ isOpen, collapsed, onClose }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href || (href !== '/platform' && pathname.startsWith(href))
  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-[230px]'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed lg:relative top-0 left-0 z-50 h-full bg-surface border-r border-subtle
        flex flex-col transition-all duration-200 shrink-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${sidebarWidth}
      `}>
        {/* Logo */}
        <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-5'} pt-6 pb-5 shrink-0`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <FiZap className="w-4 h-4 text-white" />
            </div>
            {!collapsed && (
              <span className="font-bold text-[15px] tracking-tight">
                <span className="text-secondary">Opere</span><span className="text-primary">Check</span>
              </span>
            )}
          </div>
          {!collapsed && (
            <button onClick={onClose} className="lg:hidden p-1 text-muted hover:text-secondary">
              <FiX className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-2 overflow-y-auto">
          <div className="space-y-0.5">
            {MAIN_MENU.map(item => (
              <Link key={item.href} href={item.href} onClick={onClose}
                className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-[13px] font-medium transition-all relative ${
                  isActive(item.href) ? 'text-primary bg-primary/10' : 'text-muted hover:text-main hover:bg-surface-hover'
                }`}
                title={collapsed ? item.label : undefined}
              >
                {isActive(item.href) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive(item.href) ? 'text-primary' : 'text-muted'}`} />
                {!collapsed && item.label}
              </Link>
            ))}
          </div>

          {/* Divider + General */}
          {!collapsed && (
            <div className="mt-8 mb-3 px-3">
              <p className="text-[10px] font-semibold text-muted uppercase tracking-[0.15em]">General</p>
            </div>
          )}
          {collapsed && <div className="mt-6 mb-3 border-t border-subtle mx-2" />}
          <div className="space-y-0.5">
            {GENERAL_MENU.map(item => (
              <Link key={item.label} href={item.href} onClick={onClose}
                className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-[13px] font-medium transition-all relative ${
                  isActive(item.href) && item.label !== 'Suporte' ? 'text-primary bg-primary/10' : 'text-muted hover:text-main hover:bg-surface-hover'
                }`}
                title={collapsed ? item.label : undefined}
              >
                {isActive(item.href) && item.label !== 'Suporte' && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive(item.href) && item.label !== 'Suporte' ? 'text-primary' : 'text-muted'}`} />
                {!collapsed && item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* CTA Card — so mostra expandido */}
        {!collapsed && (
          <div className="mx-3 mb-3 p-4 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-3">
              <FiZap className="w-4 h-4 text-white" />
            </div>
            <p className="text-[13px] font-bold text-main leading-tight">Controle total.</p>
            <p className="text-[13px] font-bold text-main leading-tight">Mais insights.</p>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">Gerencie clientes, planos e métricas.</p>
          </div>
        )}

        {/* Logout */}
        <div className="px-2 py-3 border-t border-subtle shrink-0">
          <button onClick={handleLogout}
            className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-[13px] text-muted hover:text-red-500 hover:bg-red-50 transition-all w-full`}
            title={collapsed ? 'Sair' : undefined}
          >
            <FiLogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && 'Sair'}
          </button>
        </div>
      </aside>
    </>
  )
}
