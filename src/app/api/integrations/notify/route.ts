import { NextRequest, NextResponse } from 'next/server'

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || ''

type ValidationData = {
  id: number
  numeroNota: string
  numeroNotaVinculada?: string
  loja: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number | null
  status: 'pendente' | 'sucesso' | 'falhou' | 'notas_diferentes'
  dataHora: string
  matchReason?: string
}

/**
 * POST /api/integrations/notify
 * Envia alertas para o Teams quando há divergência na validação
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { data } = body as { action: string; data: ValidationData }

    // Enviar para Teams se houver divergência OU notas diferentes
    if (data.status === 'falhou' || data.status === 'notas_diferentes') {
      const result = await enviarParaTeams(data)
      console.log('[Notify] Teams result:', result)
      return NextResponse.json({ success: true, teams: result })
    }

    return NextResponse.json({ success: true, message: 'Sem divergência, alerta não enviado' })
  } catch (error) {
    console.error('[API] Erro nas integrações:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

async function enviarParaTeams(data: ValidationData): Promise<{ success: boolean; error?: string }> {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn('[Teams] Webhook URL não configurado')
    return { success: false, error: 'TEAMS_WEBHOOK_URL não configurado' }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // Determinar título e cor baseado no status
  const isNotasDiferentes = data.status === 'notas_diferentes'
  const titulo = isNotasDiferentes
    ? '🔗 Notas Fiscais Diferentes Vinculadas'
    : '⚠️ Divergência na Validação de Recebimento'

  const cor = isNotasDiferentes ? 'Warning' : 'Attention'

  // Montar os fatos
  const facts = []

  if (isNotasDiferentes && data.numeroNotaVinculada) {
    facts.push(
      { title: '📋 Nota Estoquista:', value: data.numeroNota },
      { title: '📋 Nota Aprendiz:', value: data.numeroNotaVinculada }
    )
  } else {
    facts.push({ title: '📋 Nota Fiscal:', value: data.numeroNota })
  }

  facts.push(
    { title: '🏪 Loja:', value: data.loja },
    { title: '👤 Estoquista:', value: formatCurrency(data.valorEstoquista) },
    { title: '👤 Aprendiz:', value: formatCurrency(data.valorAprendiz) }
  )

  if (data.diferenca !== null) {
    facts.push({ title: '❌ Diferença:', value: formatCurrency(data.diferenca) })
  }

  facts.push({ title: '🕐 Data/Hora:', value: data.dataHora })

  // Texto explicativo
  let textoExplicativo = 'Por favor, verifique a nota fiscal e corrija a divergência.'
  if (isNotasDiferentes && data.matchReason) {
    textoExplicativo = `**Motivo do vínculo:** ${data.matchReason}\n\nAs notas fiscais são diferentes mas parecem estar relacionadas. Verifique se houve erro de digitação.`
  }

  // Adaptive Card para Teams
  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              size: 'Large',
              weight: 'Bolder',
              color: cor,
              text: titulo,
            },
            {
              type: 'FactSet',
              facts: facts,
            },
            {
              type: 'TextBlock',
              text: textoExplicativo,
              wrap: true,
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'Abrir Validações',
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/validacoes`,
            },
          ],
        },
      },
    ],
  }

  try {
    console.log('[Teams] Enviando alerta para:', TEAMS_WEBHOOK_URL.substring(0, 50) + '...')

    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    const responseText = await response.text()

    if (!response.ok) {
      console.error('[Teams] Erro:', response.status, responseText)
      throw new Error(`Teams: ${response.status} - ${responseText}`)
    }

    console.log('[Teams] Alerta enviado com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Teams] Erro:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}
