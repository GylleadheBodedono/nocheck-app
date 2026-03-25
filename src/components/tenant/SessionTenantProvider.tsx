'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { TenantCtx } from '@/hooks/useTenant'
import type { Organization, OrgRole, Feature, TenantContext } from '@/types/tenant'

/**
 * Provedor de tenant baseado na sessao do usuario (sem orgSlug na URL).
 * Le features e role do JWT app_metadata, busca org settings para branding.
 * Aplica CSS variables para white-label.
 * Usar em layouts admin/dashboard que nao tem [orgSlug] na rota.
 */
export function SessionTenantProvider({ children }: { children: React.ReactNode }) {
  const [org, setOrg] = useState<Organization | null>(null)
  const [features, setFeatures] = useState<Feature[]>([])
  const [role, setRole] = useState<OrgRole | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setIsLoading(false); return }

      const meta = session.user.app_metadata || {}
      const userMeta = session.user.user_metadata || {}
      setFeatures((meta.features as Feature[]) || [])
      setRole((meta.role as OrgRole) || null)
      setIsPlatformAdmin(meta.is_platform_admin === true || userMeta.is_platform_admin === true)

      // Buscar org para branding
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any
        const tenantRes = await sb.rpc('get_my_tenant_id')
        const orgId = tenantRes.data || meta.org_id
        if (orgId) {
          const { data } = await sb.from('organizations').select('*').eq('id', orgId).single()
          if (data) setOrg(data as Organization)
        }
      } catch { /* fallback: sem branding */ }

      setIsLoading(false)
    }
    load()
  }, [])

  // Aplicar tema white-label
  useEffect(() => {
    if (!org?.settings?.theme) return
    const theme = org.settings.theme
    const root = document.documentElement

    if (theme.primaryColor) {
      root.style.setProperty('--primary', theme.primaryColor)
      // Escurecer para hover
      const r = parseInt(theme.primaryColor.slice(1, 3), 16)
      const g = parseInt(theme.primaryColor.slice(3, 5), 16)
      const b = parseInt(theme.primaryColor.slice(5, 7), 16)
      const darker = `#${Math.max(0, r - 20).toString(16).padStart(2, '0')}${Math.max(0, g - 20).toString(16).padStart(2, '0')}${Math.max(0, b - 20).toString(16).padStart(2, '0')}`
      root.style.setProperty('--primary-hover', darker)
      root.style.setProperty('--ring-color', `rgba(${r}, ${g}, ${b}, 0.35)`)
    }

    if (theme.appName) document.title = theme.appName

    if (theme.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = theme.faviconUrl
    }

    return () => {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--primary-hover')
      root.style.removeProperty('--ring-color')
    }
  }, [org])

  const ctx = useMemo<TenantContext>(() => ({
    organization: org,
    currentRole: role,
    features,
    isPlatformAdmin,
    isOwner: role === 'owner',
    isOrgAdmin: role === 'owner' || role === 'admin',
    isManager: role === 'owner' || role === 'admin' || role === 'manager',
    orgSlug: org?.slug || null,
    isLoading,
  }), [org, role, features, isPlatformAdmin, isLoading])

  return <TenantCtx.Provider value={ctx}>{children}</TenantCtx.Provider>
}
