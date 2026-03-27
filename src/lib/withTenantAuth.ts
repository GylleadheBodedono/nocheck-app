/**
 * Middleware de autenticacao com isolamento de tenant.
 *
 * Verifica que o usuario autenticado pertence a organizacao sendo acessada.
 * Previne ataques IDOR (Insecure Direct Object Reference) onde um usuario
 * tenta manipular dados de outra organizacao.
 *
 * Uso em API routes:
 * ```ts
 * const auth = await verifyTenantAccess(request, orgId)
 * if (auth.error) return auth.error
 * // auth.user, auth.orgId, auth.role disponiveis
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/stripe'

type TenantAuthResult = {
  user: { id: string; email?: string }
  orgId: string
  role: string
  error?: never
} | {
  user?: never
  orgId?: never
  role?: never
  error: NextResponse
}

/**
 * Verifica autenticacao E pertencimento ao tenant.
 *
 * @param request - NextRequest com Bearer token
 * @param orgId - ID da organizacao sendo acessada
 * @param requiredRoles - Roles permitidos (default: owner, admin)
 * @returns { user, orgId, role } ou { error: NextResponse }
 */
export async function verifyTenantAccess(
  request: NextRequest,
  orgId: string,
  requiredRoles: string[] = ['owner', 'admin']
): Promise<TenantAuthResult> {
  // 1. Verificar autenticacao
  const auth = await verifyApiAuth(request)
  if (auth.error) return { error: auth.error }

  if (!orgId) {
    return {
      error: NextResponse.json(
        { error: 'orgId e obrigatorio' },
        { status: 400 }
      )
    }
  }

  // 2. Verificar que o usuario pertence a organizacao
  const supabase = getSupabaseAdmin()
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('user_id', auth.user.id)
    .eq('organization_id', orgId)
    .single()

  if (memberError || !membership) {
    return {
      error: NextResponse.json(
        { error: 'Voce nao tem acesso a esta organizacao' },
        { status: 403 }
      )
    }
  }

  // 3. Verificar role minimo
  if (!requiredRoles.includes(membership.role)) {
    return {
      error: NextResponse.json(
        { error: `Permissao insuficiente. Necessario: ${requiredRoles.join(' ou ')}` },
        { status: 403 }
      )
    }
  }

  return {
    user: auth.user,
    orgId,
    role: membership.role,
  }
}

/**
 * Versao para rotas que aceitam qualquer membro (nao so admin/owner).
 */
export async function verifyTenantMember(
  request: NextRequest,
  orgId: string
): Promise<TenantAuthResult> {
  return verifyTenantAccess(request, orgId, ['owner', 'admin', 'manager', 'member', 'viewer'])
}

/**
 * Verifica se um usuario e platform admin.
 * Checa app_metadata (JWT enriquecido pelo auth hook) E user_metadata (banco direto).
 * Ambos sao necessarios porque getUser() retorna dados do banco (user_metadata)
 * enquanto getSession() retorna JWT (app_metadata).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkIsPlatformAdmin(user: { app_metadata?: any; user_metadata?: any } | null): boolean {
  if (!user) return false
  return user.app_metadata?.is_platform_admin === true
    || user.user_metadata?.is_platform_admin === true
}
