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

  // Criar client SSR com cookies da request (mesmo padrão do middleware)
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
      setAll(_cookiesToSet: any) {
        // API routes não precisam setar cookies (read-only)
      },
    },
  })

  // Validar sessão do usuário
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      user: null,
      isAdmin: false,
      error: NextResponse.json(
        { error: 'Não autenticado' },
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
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await serviceClient
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
