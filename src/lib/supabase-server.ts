import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Verificar se o Supabase está configurado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Server-side Supabase client (for API routes and Server Components)
// Este arquivo só pode ser importado em Server Components ou API Routes
export async function createServerSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase não configurado.')
    return null
  }

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
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}
