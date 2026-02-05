import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Se o Supabase nao esta configurado, deixa passar
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }: CookieToSet) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { pathname } = request.nextUrl

  // Rotas publicas - sempre permite acesso
  const publicRoutes = ['/login', '/', '/offline']
  const isPublicRoute = publicRoutes.includes(pathname)

  if (isPublicRoute) {
    return supabaseResponse
  }

  // Rotas que funcionam offline ou precisam de auth
  const protectedRoutes = ['/dashboard', '/checklist', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  // Verifica se tem cookie de sessao do Supabase
  const hasSessionCookie = request.cookies.getAll().some(
    cookie => cookie.name.includes('supabase') && cookie.name.includes('auth')
  )

  // Tenta verificar autenticacao
  try {
    const { data: { user } } = await supabase.auth.getUser()

    // Se nao esta autenticado
    if (!user) {
      // Se tem cookie de sessao e rota protegida, permite
      // A pagina vai verificar autenticacao via IndexedDB
      if (hasSessionCookie && isProtectedRoute) {
        return supabaseResponse
      }

      // Redireciona para login
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Se esta autenticado e tenta acessar login, redireciona para dashboard
    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch {
    // Em caso de erro de rede (offline)
    // Se tem cookie de sessao, permite acesso
    if (hasSessionCookie) {
      return supabaseResponse
    }

    // Sem cookie e sem poder verificar
    if (isProtectedRoute) {
      // Permite - a pagina mostra tela de offline se necessario
      return supabaseResponse
    }

    // Redireciona para login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)',
  ],
}
