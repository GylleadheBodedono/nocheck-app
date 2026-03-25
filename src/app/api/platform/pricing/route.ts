export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * PUT /api/platform/pricing
 *
 * Atualiza configuracoes de pricing. Requer superadmin (is_platform_admin).
 * Recebe array de planos com campos editados, faz UPSERT em pricing_configs.
 */
export async function PUT(req: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const isPlatformAdmin = user.app_metadata?.is_platform_admin === true || user.user_metadata?.is_platform_admin === true
    if (!isPlatformAdmin) {
      return NextResponse.json({ error: 'Acesso negado — apenas superadmin' }, { status: 403 })
    }

    const plans = await req.json()
    if (!Array.isArray(plans) || plans.length === 0) {
      return NextResponse.json({ error: 'Payload invalido — esperado array de planos' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const rows = plans.map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      price_brl: p.price_brl,
      max_users: p.max_users,
      max_stores: p.max_stores,
      features: p.features,
      stripe_price_id: p.stripe_price_id || '',
      sort_order: p.sort_order ?? 0,
      is_active: p.is_active ?? true,
      updated_at: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('pricing_configs')
      .upsert(rows, { onConflict: 'id' })
      .select()

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('[API /platform/pricing] Erro:', errMsg, err)
    return NextResponse.json({ error: `Falha ao atualizar pricing: ${errMsg}` }, { status: 500 })
  }
}
