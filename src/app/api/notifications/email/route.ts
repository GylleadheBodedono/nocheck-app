export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

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
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const { to: directTo, assigneeId, subject, htmlBody } = await request.json()

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
        console.error('[Email] Erro ao buscar email do assignee:', userError || 'email nao encontrado')
        return NextResponse.json(
          { success: false, error: `Assignee ${assigneeId} nao encontrado ou sem email` },
          { status: 404 }
        )
      }

      to = user.email
      assigneeName = user.full_name || null
      console.log(`[Email] Assignee resolvido: ${assigneeName} <${to}>`)
    }

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Necessario: to (email) ou assigneeId' },
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
      return NextResponse.json({ success: true, emailId: (result as { id?: string }).id, assigneeName })
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
        return NextResponse.json({ success: true, emailId: (fallbackResult as { id?: string }).id, fallback: true, assigneeName })
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
