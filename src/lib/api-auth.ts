/**
 * Utilitário de autenticação para API routes do Next.js.
 *
 * Suporta dois mecanismos de autenticação (em ordem de prioridade):
 * 1. Bearer token via header `Authorization` (mais confiável, usado em chamadas server-to-server)
 * 2. Cookies SSR do Supabase (padrão para requisições do navegador)
 *
 * Uso:
 * ```ts
 * const auth = await verifyApiAuth(request, true) // true = exige admin
 * if (auth.error) return auth.error
 * // auth.user.id e auth.isAdmin disponíveis aqui
 * ```
 */

import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/** Resultado de autenticação bem-sucedida. */
type AuthSuccess = {
  user: { id: string; email: string }
  isAdmin: boolean
  error: null
}

/** Resultado de autenticação com falha — inclui a `NextResponse` de erro pronta para retornar. */
type AuthFailure = {
  user: null
  isAdmin: false
  error: NextResponse
}

/** União discriminada do resultado de `verifyApiAuth`. */
type AuthResult = AuthSuccess | AuthFailure

/** Dados mínimos do usuário autenticado pelo Supabase. */
type SupabaseUser = { id: string; email?: string }

/**
 * Verifies authentication in API routes via Supabase cookies or Bearer token.
 * Uses the same pattern as middleware.ts (createServerClient + cookies).
 *
 * Authentication is attempted in order:
 * 1. Bearer token in the Authorization header (preferred)
 * 2. Supabase SSR cookies (fallback for browser requests)
 *
 * @param request - NextRequest with browser cookies
 * @param requireAdmin - If true, requires `is_admin = true` in `public.users`
 * @returns AuthResult with user/isAdmin or an error response (401/403)
 */
export async function verifyApiAuth(
  request: NextRequest,
  requireAdmin = false
): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return {
      user: null,
      isAdmin: false,
      error: NextResponse.json(
        { error: 'Configuracao do servidor incompleta' },
        { status: 500 }
      ),
    }
  }

  // Try Bearer token authentication first (more reliable than cookies)
  const authHeader = request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  let user: SupabaseUser | null = null

  if (bearerToken) {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user: tokenUser }, error: tokenError } = await serviceClient.auth.getUser(bearerToken)
    if (!tokenError && tokenUser) {
      user = tokenUser
    }
  }

  // Fallback: SSR cookies from the request
  if (!user) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setAll(_cookiesToSet: { name: string; value: string }[]) {
          // API routes não precisam setar cookies (leitura apenas)
        },
      },
    })

    const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser()
    if (!authError && cookieUser) {
      user = cookieUser
    }
  }

  if (!user) {
    return {
      user: null,
      isAdmin: false,
      error: NextResponse.json(
        { error: 'Nao autenticado' },
        { status: 401 }
      ),
    }
  }

  if (!requireAdmin) {
    return {
      user: { id: user.id, email: user.email || '' },
      isAdmin: false,
      error: null,
    }
  }

  // Verify admin status in public.users using service role
  const adminCheckClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await adminCheckClient
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return {
      user: null,
      isAdmin: false,
      error: NextResponse.json(
        { error: 'Acesso restrito a administradores' },
        { status: 403 }
      ),
    }
  }

  return {
    user: { id: user.id, email: user.email || '' },
    isAdmin: true,
    error: null,
  }
}
