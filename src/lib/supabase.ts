'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// Verificar se o Supabase está configurado
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Client-side Supabase client (usado em componentes 'use client')
// Usa configuracao padrao que persiste sessao em cookies automaticamente
export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase não configurado. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env')
  }

  return createBrowserClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
  )
}

// Admin client with service role (for backend operations)
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceKey) {
    console.warn('Supabase Admin não configurado.')
  }

  return createBrowserClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    serviceKey || 'placeholder-key'
  )
}
