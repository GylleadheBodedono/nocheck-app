'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Verificar se o Supabase está configurado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Singleton para evitar múltiplas instâncias
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

// Client-side Supabase client (usado em componentes 'use client')
export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env')
  }

  // Retorna o cliente existente se já foi criado (singleton)
  if (browserClient) {
    return browserClient
  }

  browserClient = createBrowserClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
  )

  return browserClient
}

// Limpa o cliente (útil para logout)
export function clearSupabaseClient() {
  browserClient = null
}
