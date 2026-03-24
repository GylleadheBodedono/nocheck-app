// ============================================
// API CRON: Notificacoes diarias para planos de acao nao resolvidos
// ============================================
// Envia lembrete diario (in-app + email) para responsaveis de planos
// que ainda estao abertos ou em andamento.
//
// Trigger: cron externo (Upstash, cron-job.org, Cloudflare Worker) a cada 24h
// Protecao: header Authorization: Bearer {CRON_SECRET}
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createNotification, sendActionPlanEmail } from '@/lib/notificationService'

export const runtime = 'edge'

/**
 * POST /api/cron/daily-reminders
 * Envia lembretes diários (in-app + email) para responsáveis de planos de ação
 * que ainda estão com status `aberto` ou `em_andamento`.
 * Disparado por cron externo (Upstash, cron-job.org ou Cloudflare Worker) a cada 24h.
 * Autenticado via header `Authorization: Bearer {CRON_SECRET}`.
 * Retorna `{ sent, total, errors? }`.
 */
export async function POST(req: NextRequest) {
  // Verificar autenticacao do cron
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Usar service role para bypassar RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Buscar planos abertos ou em andamento
    const { data: plans, error } = await supabase
      .from('action_plans')
      .select(`
        id, title, severity, status, deadline, assigned_to, store_id,
        store:stores(name),
        field:template_fields(name)
      `)
      .in('status', ['aberto', 'em_andamento'])

    if (error) throw error
    if (!plans || plans.length === 0) {
      return NextResponse.json({ message: 'Nenhum plano pendente', sent: 0 })
    }

    let sent = 0
    const errors: string[] = []

    for (const plan of plans) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storeObj = plan.store as any
        const storeName = (Array.isArray(storeObj) ? storeObj[0]?.name : storeObj?.name) || 'Sem loja'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fieldObj = plan.field as any
        const fieldName = (Array.isArray(fieldObj) ? fieldObj[0]?.name : fieldObj?.name) || ''
        const isOverdue = plan.deadline && new Date(plan.deadline) < new Date()
        const daysLeft = plan.deadline
          ? Math.ceil((new Date(plan.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null

        const title = isOverdue
          ? `Plano VENCIDO: ${plan.title}`
          : `Lembrete: ${plan.title}`

        const message = isOverdue
          ? `O plano "${plan.title}" em ${storeName} esta vencido! Resolva o mais rapido possivel.`
          : `O plano "${plan.title}" em ${storeName} ainda nao foi concluido. ${daysLeft !== null ? `Faltam ${daysLeft} dia(s) para o prazo.` : ''}`

        // Notificacao in-app
        await createNotification(supabase, plan.assigned_to, {
          type: 'action_plan_deadline',
          title,
          message,
          link: `/admin/planos-de-acao/${plan.id}`,
          metadata: { plan_id: plan.id, severity: plan.severity, is_overdue: isOverdue },
        })

        // Email
        const deadlineStr = plan.deadline ? new Date(plan.deadline).toLocaleDateString('pt-BR') : 'Sem prazo'
        const severityMap: Record<string, string> = { baixa: '🟢', media: '🟡', alta: '🟠', critica: '🔴' }
        const severityEmoji = severityMap[plan.severity] || '⚪'

        await sendActionPlanEmail(
          plan.assigned_to,
          title,
          `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: ${isOverdue ? '#ef4444' : '#f59e0b'};">${title}</h2>
            <p>${message}</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; color: #888;">Severidade</td><td style="padding: 8px;">${severityEmoji} ${plan.severity}</td></tr>
              <tr><td style="padding: 8px; color: #888;">Loja</td><td style="padding: 8px;">${storeName}</td></tr>
              ${fieldName ? `<tr><td style="padding: 8px; color: #888;">Campo</td><td style="padding: 8px;">${fieldName}</td></tr>` : ''}
              <tr><td style="padding: 8px; color: #888;">Prazo</td><td style="padding: 8px; ${isOverdue ? 'color: #ef4444; font-weight: bold;' : ''}">${deadlineStr}</td></tr>
              <tr><td style="padding: 8px; color: #888;">Status</td><td style="padding: 8px;">${plan.status}</td></tr>
            </table>
            <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'https://nocheck.grupono.app' : 'http://localhost:3000'}/admin/planos-de-acao/${plan.id}"
              style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px;">
              Ver Plano de Acao
            </a>
          </div>
          `
        )

        sent++
      } catch (planErr) {
        errors.push(`Plan ${plan.id}: ${planErr instanceof Error ? planErr.message : 'unknown error'}`)
      }
    }

    return NextResponse.json({
      message: `Lembretes enviados: ${sent}/${plans.length}`,
      sent,
      total: plans.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[DailyReminders] Erro:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
