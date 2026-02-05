'use client'

import Link from 'next/link'
import { APP_CONFIG } from '@/lib/config'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ui'

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page p-4">
      {/* Theme Toggle no canto superior direito */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex justify-center ml-8 mb-6">
          <Image src="/Logo-dark.png" alt="Logo" width={380} height={100} className="logo-for-light" />
          <Image src="/Logo.png" alt="Logo" width={380} height={100} className="logo-for-dark" />
        </div>

        <p className="text-muted mb-8">Sistema de Checklists</p>

        <div className="space-y-4">
          <Link
            href={APP_CONFIG.routes.login}
            className="btn-primary block w-full py-3 text-center"
          >
            Entrar
          </Link>

          <Link
            href={APP_CONFIG.routes.dashboard}
            className="btn-secondary block w-full py-3 text-center"
          >
            Dashboard
          </Link>
        </div>

        <p className="text-muted text-sm mt-8">
          {APP_CONFIG.company} - v{APP_CONFIG.version}
        </p>
      </div>
    </div>
  )
}
