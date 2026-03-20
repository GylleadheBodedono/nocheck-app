/**
 * Servico de notificacoes - cria notificacoes in-app e envia emails
 */

import type { NotificationType } from '@/types/database'

type NotificationData = {
  type: NotificationType
  title: string
  message?: string
  link?: string
  metadata?: Record<string, unknown>
}

/**
 * Cria uma notificacao in-app no banco de dados
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
      console.error('[Notification] Erro ao criar notificacao:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    console.error('[Notification] Erro inesperado:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

/**
 * Envia email de notificacao via API route
 * @param accessToken - Token JWT do Supabase para autenticacao (mais confiavel que cookies)
 */
export async function sendEmailNotification(
  to: string,
  subject: string,
  htmlBody: string,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!accessToken) {
      console.warn('[Email] accessToken nao disponivel — autenticacao pode falhar')
    }

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
      console.error(`[Email] FALHA ao enviar para ${to}: status=${response.status}, body=${text}`)
      return { success: false, error: `${response.status}: ${text}` }
    }

    await response.json()
    return { success: true }
  } catch (err) {
    console.error('[Email] ERRO ao chamar API de email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}

/**
 * Envia email de plano de acao via API route, passando assigneeId para resolucao server-side.
 * Resolve o email do assignee server-side (service role) para contornar RLS.
 */
export async function sendActionPlanEmail(
  assigneeId: string,
  subject: string,
  htmlBody: string,
  accessToken?: string
): Promise<{ success: boolean; assigneeName?: string; error?: string }> {
  try {
    if (!accessToken) {
      console.warn('[Email] accessToken nao disponivel — autenticacao pode falhar')
    }

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
      console.error(`[Email] FALHA ao enviar para assignee ${assigneeId}: status=${response.status}, body=${text}`)
      return { success: false, error: `${response.status}: ${text}` }
    }

    const result = await response.json() as { success: boolean; assigneeName?: string }
    return { success: true, assigneeName: result.assigneeName || undefined }
  } catch (err) {
    console.error('[Email] ERRO ao chamar API de email:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}

/**
 * Envia alerta de plano de acao para Teams
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
      console.error('[Teams] Erro ao enviar alerta de plano de acao:', await response.text())
      return { success: false }
    }

    return { success: true }
  } catch (err) {
    console.error('[Teams] Erro ao chamar API:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Erro' }
  }
}
