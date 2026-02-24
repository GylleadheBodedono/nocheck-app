import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

type AuthSuccess = {
  user: { id: string; email: string }
  isAdmin: boolean
  error: null
}

type AuthFailure = {
  user: null
  isAdmin: false
  error: NextResponse
}

type AuthResult = AuthSuccess | AuthFailure

/**
 * Verifica autenticação em API routes via cookies do Supabase.
 * Usa o mesmo padrão do middleware.ts (createServerClient + cookies).
 *
 * @param request - NextRequest com os cookies do browser
 * @param requireAdmin - Se true, exige is_admin = true no public.users
 * @returns AuthResult com user/isAdmin ou error response (401/403)
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
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      ),
    }
  }

  // Tentar autenticacao via Bearer token (mais confiavel que cookies)
  const authHeader = request.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null

  if (bearerToken) {
    // Usar service client para validar o JWT token
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user: tokenUser }, error: tokenError } = await serviceClient.auth.getUser(bearerToken)
    if (!tokenError && tokenUser) {
      user = tokenUser
    }
  }

  // Fallback: cookies da request (padrao SSR)
  if (!user) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        setAll(_cookiesToSet: any) {
          // API routes nao precisam setar cookies (read-only)
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

  // Se não precisa de admin, retorna sucesso
  if (!requireAdmin) {
    return {
      user: { id: user.id, email: user.email || '' },
      isAdmin: false,
      error: null,
    }
  }

  // Verificar is_admin no public.users usando service role
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
