export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'
import type { SendEmailRequestDTO, SendEmailSuccessDTO, SendEmailErrorDTO } from '@/dtos'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

/**
 * POST /api/notifications/email
 * Envia email via Resend API
 *
 * Body: { to: string, subject: string, htmlBody: string }
 *   OU: { assigneeId: string, subject: string, htmlBody: string }
 *
 * Quando assigneeId e fornecido (em vez de to), busca o email do usuario
 * server-side usando service role (bypassa RLS).
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    // Extrai e tipifica o body com o DTO de envio de e-mail
    const { to: directTo, assigneeId, subject, htmlBody } = await request.json() as SendEmailRequestDTO

    if (!subject || !htmlBody) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatorios: subject, htmlBody' },
        { status: 400 }
      )
    }

    // Resolver email: direto ou via assigneeId
    let to = directTo
    let assigneeName: string | null = null

    if (!to && assigneeId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json(
          { success: false, error: 'Configuracao do servidor incompleta para buscar assignee' },
          { status: 500 }
        )
      }

      const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: user, error: userError } = await serviceClient
        .from('users')
        .select('email, full_name')
        .eq('id', assigneeId)
        .single()

      if (userError || !user?.email) {
        log.error('Erro ao buscar email do assignee', { assigneeId })
        return NextResponse.json(
          { success: false, error: `Assignee ${assigneeId} nao encontrado ou sem email` },
          { status: 404 }
        )
      }

      to = user.email
      assigneeName = user.full_name || null
      log.debug('Assignee resolvido', { assigneeId, assigneeName })
    }

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Necessario: to (email) ou assigneeId' },
        { status: 400 }
      )
    }

    if (!RESEND_API_KEY) {
      log.warn('RESEND_API_KEY nao configurada')
      return NextResponse.json(
        { success: false, error: 'RESEND_API_KEY nao configurada' },
        { status: 503 }
      )
    }

    // Tenta com email real primeiro
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html: htmlBody,
      }),
    })

    if (response.ok) {
      const result = await response.json()
      log.info('Email enviado via Resend', { to, from: FROM_EMAIL, emailId: (result as { id?: string }).id })
      // Resposta tipada via DTO de sucesso no envio de e-mail
      const successResponse: SendEmailSuccessDTO = {
        success: true,
        emailId: (result as { id?: string }).id,
        assigneeName,
      }
      return NextResponse.json(successResponse)
    }

    // Fallback: se dominio customizado falhou, tenta com onboarding@resend.dev
    const errorData = await response.json().catch(() => ({}))
    const FALLBACK_FROM = 'onboarding@resend.dev'

    if (FROM_EMAIL !== FALLBACK_FROM) {
      log.warn('Falha com dominio customizado, tentando fallback', { from: FROM_EMAIL, statusCode: response.status, fallback: FALLBACK_FROM })

      const fallbackRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FALLBACK_FROM,
          to: [to],
          subject,
          html: htmlBody,
        }),
      })

      if (fallbackRes.ok) {
        const fallbackResult = await fallbackRes.json()
        log.info('Email enviado via fallback Resend', { to, emailId: (fallbackResult as { id?: string }).id })
        // Resposta tipada via DTO indicando uso do sender de fallback
        const fallbackSuccessResponse: SendEmailSuccessDTO = {
          success: true,
          emailId: (fallbackResult as { id?: string }).id,
          fallback: true,
          assigneeName,
        }
        return NextResponse.json(fallbackSuccessResponse)
      }

      const fallbackError = await fallbackRes.json().catch(() => ({}))
      log.error('Fallback Resend tambem falhou', { to, statusCode: fallbackRes.status, resendError: JSON.stringify(fallbackError) })
    }

    log.error('Resend erro no envio de email', { to, statusCode: response.status, resendError: JSON.stringify(errorData) })
    // Resposta tipada via DTO de erro no envio de e-mail
    const errorResponse: SendEmailErrorDTO = {
      success: false,
      error: (errorData as { message?: string }).message || `Resend erro ${response.status}`,
    }
    return NextResponse.json(errorResponse, { status: 502 })
  } catch (error) {
    log.error('Erro inesperado em POST /api/notifications/email', {}, error)
    const catchErrorResponse: SendEmailErrorDTO = {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
    return NextResponse.json(catchErrorResponse, { status: 500 })
  }
}
