export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * GET /api/users/assignable
 * Retorna lista de funcoes ativas (id, name) para o dropdown de responsaveis.
 * Cada funcao pode ter multiplos usuarios vinculados.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase
      .from('functions')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { functions: data || [] },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
