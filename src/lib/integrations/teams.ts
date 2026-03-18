/**
 * Microsoft Teams Integration
 * Envia notificações via Webhook quando há divergências na validação
 */

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || ''

type ValidationAlert = {
  numeroNota: string
  loja: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number
  dataHora: string
}

/**
 * Envia alerta de divergência para o Microsoft Teams
 */
export async function enviarAlertaTeams(data: ValidationAlert): Promise<{ success: boolean; error?: string }> {
  if (!TEAMS_WEBHOOK_URL) {
    console.warn('[Teams] Webhook URL não configurado')
    return { success: false, error: 'Webhook não configurado' }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'N/A'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
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
              color: 'Attention',
              text: '⚠️ Divergência na Validação de Recebimento',
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: '📋 Nota Fiscal:',
                  value: data.numeroNota,
                },
                {
                  title: '🏪 Loja:',
                  value: data.loja,
                },
                {
                  title: '👤 Estoquista:',
                  value: formatCurrency(data.valorEstoquista),
                },
                {
                  title: '👤 Aprendiz:',
                  value: formatCurrency(data.valorAprendiz),
                },
                {
                  title: '❌ Diferença:',
                  value: formatCurrency(data.diferenca),
                },
                {
                  title: '🕐 Data/Hora:',
                  value: data.dataHora,
                },
              ],
            },
            {
              type: 'TextBlock',
              text: 'Por favor, verifique a nota fiscal e corrija a divergência.',
              wrap: true,
              color: 'Default',
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'Abrir Validações',
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://operecheck.vercel.app'}/admin/validacoes`,
            },
          ],
        },
      },
    ],
  }

  try {
    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      throw new Error(`Teams respondeu com status ${response.status}`)
    }

    console.log('[Teams] Alerta enviado com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Teams] Erro ao enviar alerta:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Envia resumo diário de validações para o Teams
 */
export async function enviarResumoDiarioTeams(data: {
  total: number
  sucesso: number
  divergencias: number
  pendentes: number
  data: string
}): Promise<{ success: boolean; error?: string }> {
  if (!TEAMS_WEBHOOK_URL) {
    return { success: false, error: 'Webhook não configurado' }
  }

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
              text: '📊 Resumo Diário - Validações de Recebimento',
            },
            {
              type: 'TextBlock',
              text: `Data: ${data.data}`,
              isSubtle: true,
            },
            {
              type: 'ColumnSet',
              columns: [
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: data.total.toString(),
                      size: 'ExtraLarge',
                      weight: 'Bolder',
                      horizontalAlignment: 'Center',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Total',
                      horizontalAlignment: 'Center',
                      isSubtle: true,
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: data.sucesso.toString(),
                      size: 'ExtraLarge',
                      weight: 'Bolder',
                      color: 'Good',
                      horizontalAlignment: 'Center',
                    },
                    {
                      type: 'TextBlock',
                      text: 'OK',
                      horizontalAlignment: 'Center',
                      isSubtle: true,
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: data.divergencias.toString(),
                      size: 'ExtraLarge',
                      weight: 'Bolder',
                      color: 'Attention',
                      horizontalAlignment: 'Center',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Divergências',
                      horizontalAlignment: 'Center',
                      isSubtle: true,
                    },
                  ],
                },
                {
                  type: 'Column',
                  width: 'stretch',
                  items: [
                    {
                      type: 'TextBlock',
                      text: data.pendentes.toString(),
                      size: 'ExtraLarge',
                      weight: 'Bolder',
                      color: 'Warning',
                      horizontalAlignment: 'Center',
                    },
                    {
                      type: 'TextBlock',
                      text: 'Pendentes',
                      horizontalAlignment: 'Center',
                      isSubtle: true,
                    },
                  ],
                },
              ],
            },
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'Ver Detalhes',
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/validacoes`,
            },
          ],
        },
      },
    ],
  }

  try {
    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      throw new Error(`Teams respondeu com status ${response.status}`)
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}
