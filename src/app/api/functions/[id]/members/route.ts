export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * GET /api/functions/[id]/members
 * Retorna usuarios ativos de uma funcao especifica.
 * Usa service role para bypass de RLS (usuarios podem estar em outras lojas).
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  const functionId = Number(params.id)
  if (!functionId || isNaN(functionId)) {
    return NextResponse.json({ error: 'Function ID invalido' }, { status: 400 })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Buscar usuarios ativos dessa funcao
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('function_id', functionId)
      .eq('is_active', true)
      .order('full_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar nome e webhook da funcao
    const { data: fnData } = await supabase
      .from('functions')
      .select('name, teams_webhook_url')
      .eq('id', functionId)
      .single()

    return NextResponse.json({
      users: users || [],
      functionName: fnData?.name || '',
      teamsWebhookUrl: fnData?.teams_webhook_url || null,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
