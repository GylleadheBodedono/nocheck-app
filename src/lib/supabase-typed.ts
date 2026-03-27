/**
 * Supabase Typed Client — elimina necessidade de `as any` nas queries.
 *
 * Uso:
 * ```ts
 * import { createTypedClient } from '@/lib/supabase-typed'
 * const db = createTypedClient()
 * const { data } = await db.from('organizations').select('*').eq('id', orgId).single()
 * // data e tipado automaticamente como Database['public']['Tables']['organizations']['Row']
 * ```
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/** Client tipado para uso no browser (anon key, respeita RLS) */
export function createTypedClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/** Client tipado com service role (bypassa RLS — usar com cuidado) */
export function createTypedAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Tipo helper para extrair Row de uma tabela */
export type TableRow<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/** Tipo helper para extrair Insert de uma tabela */
export type TableInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/** Tipo helper para extrair Update de uma tabela */
export type TableUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
