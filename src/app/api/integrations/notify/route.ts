export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger, serverLogger } from '@/lib/serverLogger'

const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || ''

type ValidationData = {
  id: number
  numeroNota: string
  numeroNotaVinculada?: string
  loja: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number | null
  status: 'pendente' | 'sucesso' | 'falhou' | 'notas_diferentes' | 'expirado'
  dataHora: string
  matchReason?: string
  setor?: string
}

type ActionPlanData = {
  title: string
  fieldName: string
  storeName: string
  severity: string
  deadline: string
  assigneeName: string
  nonConformityValue: string | null
  isReincidencia: boolean
  reincidenciaCount: number
  respondentName?: string
  respondentEmail?: string
  assigneeEmail?: string
  webhookUrl?: string | null
}

/**
 * POST /api/integrations/notify
 * Envia alertas para o Teams quando há divergência na validação ou plano de ação
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { action, data } = body as { action: string; data: ValidationData | ActionPlanData }

    // Plano de acao
    if (action === 'action_plan') {
      const result = await enviarPlanoAcaoParaTeams(data as ActionPlanData)
      log.info('Teams action_plan dispatched', { teamsSuccess: result.success })
      return NextResponse.json({ success: true, teams: result })
    }

    // Validacao cruzada (comportamento original)
    const validationData = data as ValidationData
    if (validationData.status === 'falhou' || validationData.status === 'notas_diferentes' || validationData.status === 'expirado') {
      const result = await enviarParaTeams(validationData)
      log.info('Teams validation alert dispatched', { teamsSuccess: result.success, status: validationData.status })
      return NextResponse.json({ success: true, teams: result })
    }

    return NextResponse.json({ success: true, message: 'Sem divergência, alerta não enviado' })
  } catch (error) {
    log.error('Erro inesperado em POST /api/integrations/notify', {}, error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

async function enviarParaTeams(data: ValidationData): Promise<{ success: boolean; error?: string }> {
  if (!TEAMS_WEBHOOK_URL) {
    serverLogger.warn('Webhook URL não configurado', { route: '/api/integrations/notify' })
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
  const isExpirado = data.status === 'expirado'
  let titulo: string
  let cor: string

  if (isExpirado) {
    titulo = '🕐 Nota Fiscal Sem Par Após 1 Hora'
    cor = 'Warning'
  } else if (isNotasDiferentes) {
    titulo = '🔗 Notas Fiscais Diferentes Vinculadas'
    cor = 'Warning'
  } else {
    titulo = '⚠️ Divergência na Validação Cruzada'
    cor = 'Attention'
  }

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

  facts.push({ title: '🏪 Loja:', value: data.loja })

  if (data.setor) {
    facts.push({ title: '🏷️ Setor:', value: data.setor })
  }

  if (!isExpirado) {
    facts.push(
      { title: '👤 Funcionario:', value: formatCurrency(data.valorEstoquista) },
      { title: '👤 Aprendiz:', value: formatCurrency(data.valorAprendiz) }
    )
  } else {
    // Para expirado, mostrar apenas o valor disponivel
    if (data.valorEstoquista !== null) {
      facts.push({ title: '👤 Funcionario:', value: formatCurrency(data.valorEstoquista) })
    }
    if (data.valorAprendiz !== null) {
      facts.push({ title: '👤 Aprendiz:', value: formatCurrency(data.valorAprendiz) })
    }
  }

  if (data.diferenca !== null) {
    facts.push({ title: '❌ Diferença:', value: formatCurrency(data.diferenca) })
  }

  facts.push({ title: '🕐 Data/Hora:', value: data.dataHora })

  // Texto explicativo
  let textoExplicativo = 'Por favor, verifique a nota fiscal e corrija a divergência.'
  if (isExpirado) {
    textoExplicativo = 'Esta nota fiscal foi preenchida ha mais de 1 hora e nenhum par correspondente foi encontrado no mesmo setor. Verifique se o outro funcionario preencheu o checklist.'
  } else if (isNotasDiferentes && data.matchReason) {
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
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://operecheck.vercel.app'}/admin/validacoes`,
            },
          ],
        },
      },
    ],
  }

  try {
    serverLogger.debug('Enviando alerta de validacao para Teams', { route: '/api/integrations/notify' })

    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    const responseText = await response.text()

    if (!response.ok) {
      serverLogger.error('Teams retornou erro na validacao', { statusCode: response.status, teamsResponse: responseText })
      throw new Error(`Teams: ${response.status} - ${responseText}`)
    }

    serverLogger.info('Alerta de validacao enviado ao Teams com sucesso')
    return { success: true }
  } catch (err) {
    serverLogger.error('Falha ao enviar alerta de validacao ao Teams', {}, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}

async function enviarPlanoAcaoParaTeams(data: ActionPlanData): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = data.webhookUrl || TEAMS_WEBHOOK_URL
  if (!webhookUrl) {
    serverLogger.warn('Webhook URL nao configurado para plano de acao (nem por funcao nem global)', { route: '/api/integrations/notify' })
    return { success: false, error: 'Webhook nao configurado' }
  }

  const severityEmoji: Record<string, string> = {
    baixa: '🟢',
    media: '🟡',
    alta: '🟠',
    critica: '🔴',
  }
  const emoji = severityEmoji[data.severity] || '🟡'
  const titulo = data.isReincidencia
    ? `🔄 REINCIDENCIA #${data.reincidenciaCount + 1} - Plano de Ação`
    : `${emoji} Novo Plano de Ação`

  const facts = [
    { title: '📋 Campo:', value: data.fieldName },
    { title: '🏪 Loja:', value: data.storeName },
    { title: `${emoji} Severidade:`, value: data.severity.charAt(0).toUpperCase() + data.severity.slice(1) },
    { title: '👤 Responsavel:', value: data.assigneeName },
    { title: '📅 Prazo:', value: data.deadline },
  ]

  if (data.nonConformityValue) {
    facts.splice(2, 0, { title: '❌ Valor:', value: data.nonConformityValue })
  }

  // Build @mention entities
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entities: any[] = []
  const mentionParts: string[] = []

  if (data.respondentEmail && data.respondentName) {
    entities.push({
      type: 'mention',
      text: `<at>${data.respondentName}</at>`,
      mentioned: { id: data.respondentEmail, name: data.respondentName },
    })
    mentionParts.push(`Preenchido por: <at>${data.respondentName}</at>`)
  }

  if (data.assigneeEmail && data.assigneeName) {
    entities.push({
      type: 'mention',
      text: `<at>${data.assigneeName}</at>`,
      mentioned: { id: data.assigneeEmail, name: data.assigneeName },
    })
    mentionParts.push(`Responsavel: <at>${data.assigneeName}</at>`)
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
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', color: data.severity === 'critica' ? 'Attention' : 'Warning', text: titulo },
            { type: 'TextBlock', text: data.title, wrap: true, weight: 'Bolder' },
            { type: 'FactSet', facts },
            ...(data.isReincidencia ? [{
              type: 'TextBlock',
              text: `⚠️ Este problema já ocorreu ${data.reincidenciaCount} vez(es) nos últimos 90 dias. Ação urgente necessária.`,
              wrap: true,
              color: 'Attention' as const,
            }] : []),
            ...(mentionParts.length > 0 ? [{
              type: 'TextBlock',
              text: mentionParts.join(' | '),
              wrap: true,
            }] : []),
          ],
          actions: [
            {
              type: 'Action.OpenUrl',
              title: 'Ver Planos de Ação',
              url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://operecheck.vercel.app'}/admin/planos-de-acao`,
            },
          ],
          ...(entities.length > 0 ? { msteams: { entities } } : {}),
        },
      },
    ],
  }

  try {
    serverLogger.debug('Enviando alerta de plano de acao para Teams', { route: '/api/integrations/notify' })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })

    if (!response.ok) {
      const text = await response.text()
      serverLogger.error('Teams retornou erro no plano de acao', { statusCode: response.status, teamsResponse: text })
      return { success: false, error: `Teams: ${response.status}` }
    }

    serverLogger.info('Alerta de plano de acao enviado ao Teams com sucesso')
    return { success: true }
  } catch (err) {
    serverLogger.error('Falha ao enviar alerta de plano de acao ao Teams', {}, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}
