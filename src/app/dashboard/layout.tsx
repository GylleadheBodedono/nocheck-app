'use client'

import { useState, useEffect } from 'react'
import { PermanentSidebar } from '@/components/ui/PermanentSidebar'
import { AdminHeader } from '@/components/ui/AdminHeader'
import { SessionTenantProvider } from '@/components/tenant/SessionTenantProvider'
import { FiMenu } from 'react-icons/fi'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  return (
    <SessionTenantProvider>
    <div className="h-screen flex overflow-hidden bg-page">
      <PermanentSidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        variant="employee"
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <AdminHeader>
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 text-muted hover:text-main hover:bg-surface-hover rounded-xl transition-colors"
            title="Menu"
          >
            <FiMenu className="w-5 h-5" />
          </button>
        </AdminHeader>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
    </SessionTenantProvider>
  )
}
