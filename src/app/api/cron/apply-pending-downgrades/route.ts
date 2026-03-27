// ============================================
// API CRON: Aplicar downgrades de plano agendados
// ============================================
// Quando um org faz downgrade (ex: enterprise → starter), o plano atual
// é mantido até o fim do período de cobrança (current_period_end).
// Este cron verifica orgs com pending_plan e aplica o downgrade quando
// o período termina.
//
// Trigger: cron externo a cada 24h (ou mais frequente)
// Protecao: header Authorization: Bearer {CRON_SECRET}
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, updateOrgPlan } from '@/lib/stripe'
import { serverLogger } from '@/lib/serverLogger'

export const runtime = 'edge'

/**
 * POST /api/cron/apply-pending-downgrades
 * Aplica downgrades agendados cujo current_period_end já passou.
 * Disparado por cron externo a cada 24h.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  // Buscar orgs com downgrade agendado cujo período já expirou
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, plan, pending_plan, current_period_end')
    .not('pending_plan', 'is', null)
    .eq('cancel_at_period_end', false)
    .lte('current_period_end', new Date().toISOString())

  if (error) {
    serverLogger.error('[Cron] apply-pending-downgrades: erro ao buscar orgs', { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orgs || orgs.length === 0) {
    serverLogger.info('[Cron] apply-pending-downgrades: nenhum downgrade pendente')
    return NextResponse.json({ applied: 0 })
  }

  let applied = 0
  const errors: string[] = []

  for (const org of orgs) {
    try {
      await updateOrgPlan(org.id, org.pending_plan, {
        pending_plan: null,
        previous_plan: null,
        current_period_end: null,
      })
      applied++
      serverLogger.info(`[Cron] Downgrade aplicado: org ${org.id} (${org.name}) ${org.plan} → ${org.pending_plan}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${org.id}: ${msg}`)
      serverLogger.error(`[Cron] Erro ao aplicar downgrade para org ${org.id}`, { error: msg })
    }
  }

  return NextResponse.json({ applied, total: orgs.length, ...(errors.length ? { errors } : {}) })
}
