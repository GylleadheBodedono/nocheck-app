'use client'

/**
 * Cliente Supabase para uso no navegador (componentes 'use client').
 * Implementa padrão singleton para evitar múltiplas instâncias.
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/** Indica se as variáveis de ambiente do Supabase estão configuradas. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Instância singleton — criada uma única vez por carregamento de página
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Retorna o cliente Supabase tipado para o banco de dados.
 * Usa padrão singleton: reutiliza a instância existente se já criada.
 *
 * @returns Cliente Supabase com tipagem completa do banco de dados
 */
export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient<Database>(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
  )

  return browserClient
}
