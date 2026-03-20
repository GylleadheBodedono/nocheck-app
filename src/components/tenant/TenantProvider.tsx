// ============================================
// TenantProvider — Provedor de contexto multi-tenant
// ============================================
// Carrega a organizacao atual baseado no orgSlug da URL
// e disponibiliza via TenantCtx para todos os filhos.
//
// Responsabilidades:
//   - Buscar dados da org no Supabase (via React Query)
//   - Validar que o usuario e membro da org
//   - Aplicar tema white-label (CSS custom properties)
//   - Fornecer TenantContext para useTenant()
//
// Deve ser usado no layout de rotas /[orgSlug]/*
// ============================================

'use client'

import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { TenantCtx } from '@/hooks/useTenant'
import { darkenColor, hexToRgb } from '@/lib/color-utils'
import type { Organization, OrgRole, Feature, TenantContext } from '@/types/tenant'

/** Props do componente TenantProvider */
interface TenantProviderProps {
  children: React.ReactNode
  /** Slug da organizacao extraido da URL (ex: "minha-empresa") */
  orgSlug: string
}

/**
 * Provedor de contexto multi-tenant.
 *
 * Busca a organizacao pelo slug, valida a sessao do usuario,
 * aplica o tema white-label via CSS custom properties e
 * disponibiliza o {@link TenantContext} para toda a arvore de componentes.
 *
 * @example
 * ```tsx
 * <TenantProvider orgSlug={params.orgSlug}>
 *   <AppLayout />
 * </TenantProvider>
 * ```
 */
export function TenantProvider({ children, orgSlug }: TenantProviderProps) {
  const supabase = createClient()

  // Buscar dados da sessao para extrair app_metadata
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    },
    staleTime: Infinity, // Sessao nao muda frequentemente
  })

  // Extrair claims do JWT (injetados pelo custom_access_token_hook)
  const appMeta = session?.user?.app_metadata || {}
  const isPlatformAdmin = appMeta.is_platform_admin === true
  const jwtRole = typeof appMeta.role === 'string' ? (appMeta.role as OrgRole) : undefined

  // Buscar organizacao pelo slug (valida que existe)
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization', orgSlug],
    queryFn: async (): Promise<Organization | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .single()

      if (error || !data) return null
      return data as Organization
    },
    enabled: !!orgSlug,
  })

  // Aplicar tema white-label quando org carrega
  useEffect(() => {
    if (!organization?.settings?.theme) return

    const theme = organization.settings.theme
    const root = document.documentElement

    // Aplicar cor primaria + hover (versao escurecida)
    if (theme.primaryColor) {
      root.style.setProperty('--primary', theme.primaryColor)
      root.style.setProperty('--primary-hover', darkenColor(theme.primaryColor))
      // Ring color com opacidade
      const { r, g, b } = hexToRgb(theme.primaryColor)
      root.style.setProperty('--ring-color', `rgba(${r}, ${g}, ${b}, 0.35)`)
    }

    // Aplicar accent se definido (via campo extra no theme)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accentColor = (theme as any).accentColor as string | undefined
    if (accentColor) {
      root.style.setProperty('--accent', accentColor)
      root.style.setProperty('--accent-hover', darkenColor(accentColor))
    }

    // Titulo da aba do navegador
    if (theme.appName) {
      document.title = theme.appName
    }

    // Favicon dinamico
    if (theme.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = theme.faviconUrl
    }

    // Limpar ao desmontar
    return () => {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--primary-hover')
      root.style.removeProperty('--ring-color')
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-hover')
    }
  }, [organization])

  // Montar contexto final
  const context: TenantContext = useMemo(() => {
    const role = jwtRole ?? null
    const features = Array.isArray(appMeta.features) ? (appMeta.features as Feature[]) : []
    const isOwner = role === 'owner'
    const isOrgAdmin = role === 'owner' || role === 'admin'
    const isManager = role === 'owner' || role === 'admin' || role === 'manager'

    return {
      organization: organization ?? null,
      currentRole: role,
      features,
      isPlatformAdmin,
      isOwner,
      isOrgAdmin,
      isManager,
      orgSlug,
      isLoading: orgLoading,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, jwtRole, isPlatformAdmin, orgSlug, orgLoading, session])

  return (
    <TenantCtx.Provider value={context}>
      {children}
    </TenantCtx.Provider>
  )
}
