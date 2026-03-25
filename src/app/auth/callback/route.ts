export const runtime = 'edge'

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { serverLogger } from '@/lib/serverLogger'

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * GET /auth/callback
 * Callback do Supabase Auth (OAuth e magic link).
 * Troca o `code` por sessão via `exchangeCodeForSession` e seta os cookies SSR.
 * - Em caso de `type=recovery`, redireciona para `/auth/reset-password`
 * - Caso contrário, redireciona para `/auth/confirmed`
 * - Em erro, redireciona para `/login?error=...`
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // Se houve erro (link expirado, etc)
  if (error) {
    const redirectUrl = new URL('/login', origin)
    redirectUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
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

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      serverLogger.error('Erro na troca de código OAuth', { route: '/auth/callback' }, exchangeError)
      const redirectUrl = new URL('/login', origin)
      redirectUrl.searchParams.set('error', 'Erro ao confirmar email. Tente novamente.')
      return NextResponse.redirect(redirectUrl)
    }

    // Se é recovery (reset de senha), redireciona para definir nova senha
    const type = searchParams.get('type')
    const redirectUrl = type === 'recovery'
      ? new URL('/auth/reset-password', origin)
      : new URL('/auth/confirmed', origin)

    const response = NextResponse.redirect(redirectUrl)
    // Copiar cookies de sessao do supabaseResponse para o redirect
    supabaseResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value)
    })
    return response
  }

  // Sem código, redireciona para login
  return NextResponse.redirect(new URL('/login', origin))
}
