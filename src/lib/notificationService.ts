/**
 * Serviço de notificações — cria notificações in-app e envia emails/alertas Teams.
 *
 * Funções exportadas:
 * - `createNotification`        — persiste notificação in-app no banco
 * - `sendEmailNotification`     — envia email via API route `/api/notifications/email`
 * - `sendActionPlanEmail`       — email de plano de ação (assignee resolvido server-side)
 * - `sendActionPlanTeamsAlert`  — alerta no Microsoft Teams via webhook
 */

import type { NotificationType } from '@/types/database'
import { serverLogger } from '@/lib/serverLogger'

/** Dados necessários para criar uma notificação in-app. */
type NotificationData = {
  type: NotificationType
  title: string
  message?: string
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Cria uma notificação in-app persistida na tabela `notifications`.
 *
 * @param supabase - Cliente Supabase com permissão de escrita em `notifications`
 * @param userId   - UUID do usuário destinatário
 * @param data     - Dados da notificação (tipo, título, mensagem, link, metadata)
 * @returns `{ success: true }` ou `{ success: false, error: mensagem }`
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  data: NotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('notifications')
      .insert({
        user_id: userId,
        type: data.type,
        title: data.title,
        message: data.message || null,
        link: data.link || null,
        action_url: data.link || null,
        metadata: data.metadata || null,
      })

    if (error) {
      serverLogger.error('Erro ao criar notificacao in-app', { userId }, error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    serverLogger.error('Erro inesperado ao criar notificacao', { userId }, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

/**
 * Envia email de notificação via API route `/api/notifications/email`.
 *
 * @param to          - Endereço de email do destinatário
 * @param subject     - Assunto do email
 * @param htmlBody    - Corpo do email em HTML
 * @param accessToken - Token JWT do Supabase para autenticação (mais confiável que cookies)
 * @returns `{ success: true }` ou `{ success: false, error: mensagem }`
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  htmlBody: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    // Usar URL absoluta para evitar problemas com relative fetch
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || ''
    const emailUrl = `${baseUrl}/api/notifications/email`

    const response = await fetch(emailUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ to, subject, htmlBody }),
    })

    if (!response.ok) {
      const text = await response.text()
      serverLogger.error('Falha ao enviar email via API route', { to, statusCode: response.status, body: text })
      return { success: false, error: `${response.status}: ${text}` }
    }

    await response.json()
    return { success: true }
  } catch (err) {
    serverLogger.error('Erro ao chamar API de email', { to }, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}

/**
 * Envia email de plano de ação via API route, resolvendo o email do assignee server-side.
 * O email do destinatário é resolvido pelo servidor usando service role para contornar RLS.
 *
 * @param assigneeId  - UUID do usuário responsável pelo plano de ação
 * @param subject     - Assunto do email
 * @param htmlBody    - Corpo do email em HTML
 * @param accessToken - Token JWT do Supabase para autenticação
 * @returns `{ success: true, assigneeName? }` ou `{ success: false, error: mensagem }`
 */
export async function sendActionPlanEmail(
  assigneeId: string,
  subject: string,
  htmlBody: string,
  accessToken?: string
): Promise<{ success: boolean; assigneeName?: string; error?: string }> {
  try {

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || ''
    const emailUrl = `${baseUrl}/api/notifications/email`

    const response = await fetch(emailUrl, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ assigneeId, subject, htmlBody }),
    })

    if (!response.ok) {
      const text = await response.text()
      serverLogger.error('Falha ao enviar email de plano de acao', { assigneeId, statusCode: response.status, body: text })
      return { success: false, error: `${response.status}: ${text}` }
    }

    const result = await response.json() as { success: boolean; assigneeName?: string }
    return { success: true, assigneeName: result.assigneeName || undefined }
  } catch (err) {
    serverLogger.error('Erro ao chamar API de email para plano de acao', { assigneeId }, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}

/**
 * Envia alerta de plano de ação para o Microsoft Teams via webhook configurado.
 * Chama a API route `/api/integrations/notify` com action `action_plan`.
 *
 * @param data - Dados do alerta (título, campo, loja, severidade, prazo, etc.)
 * @returns `{ success: true }` ou `{ success: false, error: mensagem }`
 */
export async function sendActionPlanTeamsAlert(data: {
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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/integrations/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'action_plan',
        data,
      }),
    })

    if (!response.ok) {
      serverLogger.error('Erro ao enviar alerta de plano de acao ao Teams', { statusCode: response.status })
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    serverLogger.error('Erro ao chamar API de Teams para plano de acao', {}, err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}
