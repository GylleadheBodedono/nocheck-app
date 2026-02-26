export const runtime = 'edge'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * GET /auth/confirm
 * Rota que recebe o link de confirmação de email do Supabase
 * e verifica o token diretamente via verifyOtp (sem redirect externo)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | null

  if (!token_hash || !type) {
    const redirectUrl = new URL('/login', origin)
    redirectUrl.searchParams.set('error', 'Link de confirmação inválido')
    return NextResponse.redirect(redirectUrl)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }: CookieToSet) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: options.maxAge || 60 * 60 * 24 * 7,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            })
          })
        },
      },
    }
  )

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  })

  if (verifyError) {
    console.error('[Auth Confirm] Erro na verificação:', verifyError)
    const redirectUrl = new URL('/login', origin)
    redirectUrl.searchParams.set('error', 'Link expirado ou inválido. Solicite um novo.')
    return NextResponse.redirect(redirectUrl)
  }

  // Recovery → pagina de redefinir senha (sessao ja esta ativa via verifyOtp)
  if (type === 'recovery') {
    const resetUrl = new URL('/auth/reset-password', origin)
    const response = NextResponse.redirect(resetUrl)
    // Copiar cookies do supabaseResponse para o redirect
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value)
    })
    return response
  }

  // Signup/invite → pagina de confirmacao
  const confirmedUrl = new URL('/auth/confirmed', origin)
  const response = NextResponse.redirect(confirmedUrl)
  supabaseResponse.cookies.getAll().forEach(cookie => {
    response.cookies.set(cookie.name, cookie.value)
  })
  return response
}
