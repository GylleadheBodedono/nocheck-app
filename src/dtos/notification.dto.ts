// ============================================
// DTOs — Notificações por E-mail
// ============================================
// Tipos para envio de e-mails transacionais via Resend API.
// O endpoint aceita dois formatos de destinatário:
//   1. E-mail direto: { to, subject, htmlBody }
//   2. Via responsável: { assigneeId, subject, htmlBody }
//
// Quando `assigneeId` é usado, o servidor resolve o e-mail
// via service role (bypassa RLS) para garantir privacidade.
// ============================================

/**
 * Body do POST /api/notifications/email
 *
 * Forneça `to` OU `assigneeId`, mas não ambos.
 * Pelo menos um dos dois deve estar presente.
 */
export interface SendEmailRequestDTO {
  /**
   * E-mail direto do destinatário.
   * Use este campo quando o e-mail já é conhecido no cliente.
   */
  to?: string
  /**
   * UUID do usuário no Supabase (public.users.id).
   * O servidor buscará o e-mail server-side usando service role.
   * Use este campo para enviar e-mail sem expor o endereço no cliente.
   */
  assigneeId?: string
  /** Assunto do e-mail */
  subject: string
  /** Corpo do e-mail em HTML */
  htmlBody: string
}

/**
 * Resposta do POST /api/notifications/email em caso de sucesso.
 */
export interface SendEmailSuccessDTO {
  success: true
  /** ID único do e-mail registrado no Resend (para rastreamento) */
  emailId?: string
  /**
   * Se true, o e-mail foi enviado via remetente de fallback (onboarding@resend.dev).
   * Ocorre quando o domínio customizado configurado em RESEND_FROM_EMAIL falha.
   */
  fallback?: boolean
  /**
   * Nome completo do destinatário.
   * Preenchido apenas quando o destinatário foi resolvido via `assigneeId`.
   */
  assigneeName?: string | null
}

/**
 * Resposta do POST /api/notifications/email em caso de falha.
 */
export interface SendEmailErrorDTO {
  success: false
  /** Mensagem descritiva do erro */
  error: string
}

/** União dos possíveis retornos do POST /api/notifications/email */
export type SendEmailResponseDTO = SendEmailSuccessDTO | SendEmailErrorDTO
