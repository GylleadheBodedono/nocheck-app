import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exportarValidacoesSheet } from '@/lib/integrations/sheets'
import { enviarResumoDiarioTeams } from '@/lib/integrations/teams'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/integrations/export
 * Exporta validações para Google Sheets e envia resumo para Teams
 *
 * Body:
 * - sheets: boolean (exportar para Sheets)
 * - teams: boolean (enviar resumo para Teams)
 * - days: number (quantos dias de dados, default 7)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sheets = true, teams = true, days = 7 } = body

    // Criar cliente Supabase com service role (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calcular data de inicio
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Buscar validações
    const { data: validations, error } = await supabase
      .from('cross_validations')
      .select(`
        *,
        store:stores(name)
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Erro ao buscar validações: ${error.message}`)
    }

    const results: Record<string, unknown> = {
      validationsCount: validations?.length || 0,
    }

    // Exportar para Google Sheets
    if (sheets && validations && validations.length > 0) {
      const rows = validations.map(v => ({
        id: v.id,
        data: new Date(v.created_at).toLocaleString('pt-BR'),
        loja: v.store?.name || `Loja ${v.store_id}`,
        numeroNota: v.numero_nota,
        valorEstoquista: v.valor_estoquista,
        valorAprendiz: v.valor_aprendiz,
        diferenca: v.diferenca,
        status: v.status as 'pendente' | 'sucesso' | 'falhou',
      }))

      const sheetsResult = await exportarValidacoesSheet(rows)
      results.sheets = sheetsResult
    }

    // Enviar resumo para Teams
    if (teams && validations) {
      const stats = {
        total: validations.length,
        sucesso: validations.filter(v => v.status === 'sucesso').length,
        divergencias: validations.filter(v => v.status === 'falhou').length,
        pendentes: validations.filter(v => v.status === 'pendente').length,
        data: new Date().toLocaleDateString('pt-BR'),
      }

      const teamsResult = await enviarResumoDiarioTeams(stats)
      results.teams = teamsResult
    }

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (err) {
    console.error('[API Export] Error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/integrations/export
 * Retorna status das integrações
 */
export async function GET() {
  const sheetsConfigured = !!process.env.GOOGLE_SHEETS_ID
  const teamsConfigured = !!process.env.TEAMS_WEBHOOK_URL

  return NextResponse.json({
    integrations: {
      sheets: {
        configured: sheetsConfigured,
        sheetId: sheetsConfigured ? process.env.GOOGLE_SHEETS_ID?.slice(0, 10) + '...' : null,
      },
      teams: {
        configured: teamsConfigured,
      },
    },
  })
}
