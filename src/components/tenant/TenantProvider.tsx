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
import type { Organization, OrgRole, Feature, TenantContext } from '@/types/tenant'

interface TenantProviderProps {
  children: React.ReactNode
  orgSlug: string
}

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
  const appMeta = session?.user?.app_metadata ?? {}
  const isPlatformAdmin = appMeta.is_platform_admin === true
  const jwtRole = appMeta.role as OrgRole | undefined

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

    const { primaryColor, appName } = organization.settings.theme
    if (primaryColor) {
      document.documentElement.style.setProperty('--color-primary', primaryColor)
    }
    if (appName) {
      document.title = appName
    }

    // Limpar ao desmontar
    return () => {
      document.documentElement.style.removeProperty('--color-primary')
    }
  }, [organization])

  // Montar contexto final
  const context: TenantContext = useMemo(() => {
    const role = jwtRole ?? null
    const features = (appMeta.features ?? []) as Feature[]
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
