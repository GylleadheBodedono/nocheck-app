export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

/**
 * POST /api/notifications/email
 * Envia email via Resend API
 *
 * Body: { to: string, subject: string, htmlBody: string }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const { to, subject, htmlBody } = await request.json()

    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatorios: to, subject, htmlBody' },
        { status: 400 }
      )
    }

    if (!RESEND_API_KEY) {
      console.warn('[Email] RESEND_API_KEY nao configurada')
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
      console.log(`[Email] Enviado via Resend para ${to}, from: ${FROM_EMAIL}, id: ${(result as { id?: string }).id}`)
      return NextResponse.json({ success: true, emailId: (result as { id?: string }).id })
    }

    // Fallback: se dominio customizado falhou, tenta com onboarding@resend.dev
    const errorData = await response.json().catch(() => ({}))
    const FALLBACK_FROM = 'onboarding@resend.dev'

    if (FROM_EMAIL !== FALLBACK_FROM) {
      console.warn(`[Email] Falha com ${FROM_EMAIL} (${response.status}), tentando fallback ${FALLBACK_FROM}...`)

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
        console.log(`[Email] Enviado via fallback para ${to}, id: ${(fallbackResult as { id?: string }).id}`)
        return NextResponse.json({ success: true, emailId: (fallbackResult as { id?: string }).id, fallback: true })
      }

      const fallbackError = await fallbackRes.json().catch(() => ({}))
      console.error('[Email] Fallback tambem falhou:', fallbackRes.status, fallbackError)
    }

    console.error('[Email] Resend erro:', response.status, errorData)
    return NextResponse.json(
      { success: false, error: (errorData as { message?: string }).message || `Resend erro ${response.status}` },
      { status: 502 }
    )
  } catch (error) {
    console.error('[Email] Erro:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
