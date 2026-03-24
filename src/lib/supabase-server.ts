/**
 * Cliente Supabase para uso server-side (API Routes e Server Components).
 * NÃO importar em componentes 'use client' — use src/lib/supabase.ts para isso.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** Duração padrão dos cookies de sessão: 7 dias em segundos. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/**
 * Cria um cliente Supabase server-side com gerenciamento de cookies.
 * Retorna `null` se as variáveis de ambiente não estiverem configuradas.
 *
 * @returns Cliente Supabase tipado ou `null` se não configurado
 */
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) return null

  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
              // Garante longa duração dos cookies
              const enhancedOptions: CookieOptions = {
                ...options,
                maxAge: options.maxAge || COOKIE_MAX_AGE,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
              }
              cookieStore.set(name, value, enhancedOptions)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
