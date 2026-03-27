export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serverLogger } from '@/lib/serverLogger'

/**
 * GET /api/pricing
 *
 * Endpoint publico (sem auth) — retorna planos ativos ordenados por sort_order.
 * Usado pela landing page e qualquer pagina que exibe precos.
 * Cache de 5 minutos via CDN.
 */
export async function GET() {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )

    const { data, error } = await supabase
      .from('pricing_configs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (err) {
    serverLogger.error('[API /pricing] Erro', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Falha ao carregar pricing' }, { status: 500 })
  }
}
