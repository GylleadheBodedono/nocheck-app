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
      setRole((meta.role as OrgRole) || null)
      // Checar APENAS app_metadata (injetado pelo auth hook, seguro)
      setIsPlatformAdmin(meta.is_platform_admin === true)

      // Buscar org do banco (features atualizadas, nao depende do JWT stale)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any
        const tenantRes = await sb.rpc('get_my_tenant_id')
        const orgId = tenantRes.data || meta.org_id
        if (orgId) {
          const { data } = await sb.from('organizations').select('*').eq('id', orgId).single()
          if (data) {
            setOrg(data as Organization)
            // Features do banco (sempre atualizadas) em vez do JWT (pode estar stale)
            setFeatures((data.features as Feature[]) || (meta.features as Feature[]) || [])
          } else {
            setFeatures((meta.features as Feature[]) || [])
          }
        } else {
          setFeatures((meta.features as Feature[]) || [])
        }
      } catch {
        // Fallback: usar features do JWT se nao conseguir buscar do banco
        setFeatures((meta.features as Feature[]) || [])
      }

      setIsLoading(false)
    }
    load()
  }, [])

  // Aplicar tema white-label do tenant (todas as variaveis CSS)
  useEffect(() => {
    if (!org?.settings?.theme) return
    const theme = org.settings.theme
    const root = document.documentElement
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = theme as any

    // Detectar tema atual (light ou dark)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const colors = isDark ? t.darkColors : t.lightColors

    // Map de camelCase → CSS variable
    const varMap: Record<string, string> = {
      primary: '--primary', primaryHover: '--primary-hover', primaryForeground: '--primary-foreground',
      secondary: '--secondary', secondaryHover: '--secondary-hover', secondaryForeground: '--secondary-foreground',
      accent: '--accent', accentHover: '--accent-hover', accentForeground: '--accent-foreground',
      bgPage: '--bg-page', bgSurface: '--bg-surface', bgSurfaceHover: '--bg-surface-hover', bgSurfaceActive: '--bg-surface-active',
      textMain: '--text-main', textSecondary: '--text-secondary', textMuted: '--text-muted', textInverse: '--text-inverse',
      borderSubtle: '--border-subtle', borderDefault: '--border-default', borderStrong: '--border-strong',
      statusSuccessBg: '--status-success-bg', statusSuccessText: '--status-success-text', statusSuccessBorder: '--status-success-border',
      statusErrorBg: '--status-error-bg', statusErrorText: '--status-error-text', statusErrorBorder: '--status-error-border',
      statusWarningBg: '--status-warning-bg', statusWarningText: '--status-warning-text', statusWarningBorder: '--status-warning-border',
      statusInfoBg: '--status-info-bg', statusInfoText: '--status-info-text', statusInfoBorder: '--status-info-border',
    }

    // Aplicar cores customizadas (se existirem)
    if (colors && typeof colors === 'object') {
      for (const [key, cssVar] of Object.entries(varMap)) {
        if (colors[key]) root.style.setProperty(cssVar, colors[key])
      }
      // Ring color baseado na primary
      if (colors.primary) {
        const r = parseInt(colors.primary.slice(1, 3), 16)
        const g = parseInt(colors.primary.slice(3, 5), 16)
        const b = parseInt(colors.primary.slice(5, 7), 16)
        root.style.setProperty('--ring-color', `rgba(${r}, ${g}, ${b}, 0.35)`)
      }
    } else if (theme.primaryColor) {
      // Fallback: so primary color (compatibilidade com branding antigo)
      root.style.setProperty('--primary', theme.primaryColor)
      const r = parseInt(theme.primaryColor.slice(1, 3), 16)
      const g = parseInt(theme.primaryColor.slice(3, 5), 16)
      const b = parseInt(theme.primaryColor.slice(5, 7), 16)
      root.style.setProperty('--primary-hover', `#${Math.max(0, r - 20).toString(16).padStart(2, '0')}${Math.max(0, g - 20).toString(16).padStart(2, '0')}${Math.max(0, b - 20).toString(16).padStart(2, '0')}`)
      root.style.setProperty('--ring-color', `rgba(${r}, ${g}, ${b}, 0.35)`)
    }

    if (theme.appName && theme.appName !== 'Sistema') document.title = theme.appName

    if (theme.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = theme.faviconUrl
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
