export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * GET /api/presets/active
 * Retorna lista de modelos de plano de acao ativos para qualquer usuario autenticado.
 * Usa service role para bypass de RLS.
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabase
      .from('action_plan_presets')
      .select('id, name, severity, deadline_days')
      .eq('is_active', true)
      .order('name')

    if (error) {
      log.error('Erro ao buscar presets ativos', {}, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { presets: data || [] },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    )
  } catch (err) {
    log.error('Erro inesperado em GET /api/presets/active', {}, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
