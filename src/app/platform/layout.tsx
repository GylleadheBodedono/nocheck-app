'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { PlatformSidebar } from '@/components/platform/PlatformSidebar'
import { PlatformSearch } from '@/components/platform/PlatformSearch'
import { ClientDetailModal } from '@/components/platform/ClientDetailModal'
import { FiMenu, FiBell, FiHelpCircle } from 'react-icons/fi'
import { LoadingPage } from '@/components/ui'

// Breadcrumb baseado na rota
const TITLES: Record<string, string> = {
  '/platform': 'Dashboard',
  '/platform/clientes': 'Clientes',
  '/platform/configuracoes': 'Configuracoes',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [userInitial, setUserInitial] = useState('A')
  const [searchOrgId, setSearchOrgId] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const isPlatformAdmin = user.user_metadata?.is_platform_admin === true || user.app_metadata?.is_platform_admin === true
      if (!isPlatformAdmin) { router.push('/dashboard'); return }
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin'
      setUserName(name)
      setUserInitial(name[0]?.toUpperCase() || 'A')
      setLoading(false)
    }
    checkAccess()
  }, [router])

  if (loading) return <LoadingPage />

  const pageTitle = TITLES[pathname] || (pathname.includes('/clientes/') ? 'Detalhe do Cliente' : 'Plataforma')

  return (
    <div className="h-screen flex overflow-hidden bg-page text-main">
      {/* Sidebar — sempre visivel em desktop, drawer em mobile */}
      <PlatformSidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="shrink-0 bg-surface border-b border-subtle px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-muted hover:text-secondary rounded-lg hover:bg-surface-hover">
              <FiMenu className="w-5 h-5" />
            </button>

            {/* Desktop collapse toggle */}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:block p-2 text-muted hover:text-secondary rounded-lg hover:bg-surface-hover">
              <FiMenu className="w-5 h-5" />
            </button>

            {/* Breadcrumb */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted">Pages / Overview</p>
              <p className="text-sm font-semibold text-main">{pageTitle}</p>
            </div>

            {/* Search */}
            <PlatformSearch onSelectOrg={setSearchOrgId} />

            {/* Actions */}
            <button className="p-2 text-muted hover:text-secondary rounded-lg hover:bg-surface-hover"><FiBell className="w-4 h-4" /></button>
            <button className="p-2 text-muted hover:text-secondary rounded-lg hover:bg-surface-hover"><FiHelpCircle className="w-4 h-4" /></button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-xs font-bold text-white cursor-pointer shrink-0" title={userName}>
              {userInitial}
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Modal opened from global search */}
      <ClientDetailModal
        orgId={searchOrgId}
        onClose={() => setSearchOrgId(null)}
      />
    </div>
  )
}
