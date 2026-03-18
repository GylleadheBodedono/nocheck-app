// ============================================
// useTenant — Hook de contexto do tenant atual
// ============================================
// Fornece informacoes da organizacao, role do usuario,
// features do plano, e flags de nivel de acesso.
//
// Uso:
//   const { organization, isOrgAdmin, orgSlug } = useTenant()
//
// O TenantProvider deve estar acima na arvore de componentes.
// Para rotas /[orgSlug]/* o provider carrega a org automaticamente.
// ============================================

'use client'

import { createContext, useContext } from 'react'
import type { TenantContext } from '@/types/tenant'

// Contexto padrao: nenhum tenant carregado
const defaultContext: TenantContext = {
  organization: null,
  currentRole: null,
  features: [],
  isPlatformAdmin: false,
  isOwner: false,
  isOrgAdmin: false,
  isManager: false,
  orgSlug: null,
  isLoading: true,
}

// Contexto React — preenchido pelo TenantProvider
export const TenantCtx = createContext<TenantContext>(defaultContext)

/**
 * Hook para acessar o contexto do tenant atual.
 * Retorna org, role, features, e flags de acesso.
 *
 * @throws Se usado fora do TenantProvider (retorna contexto vazio, nao crasha)
 */
export function useTenant(): TenantContext {
  return useContext(TenantCtx)
}
