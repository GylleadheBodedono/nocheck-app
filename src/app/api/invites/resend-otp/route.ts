export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter, getRequestIdentifier } from '@/lib/rateLimit'
import { createRequestLogger } from '@/lib/serverLogger'
import { escapeHtml } from '@/lib/validation'

/**
 * POST /api/invites/resend-otp
 * Public — regenerates a 6-digit OTP for an unconfirmed invite signup
 * and resends the verification email with both OTP and confirmation link.
 *
 * Body: { email }
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  const { success: rateLimitOk } = authLimiter.check(getRequestIdentifier(request))
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email obrigatorio' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find unconfirmed user by email via public.users, then fetch auth user
    const { data: publicUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (!publicUser) {
      // Don't reveal if user exists — return success anyway
      return NextResponse.json({ success: true })
    }

    const { data: authData } = await adminClient.auth.admin.getUserById(publicUser.id)
    const user = authData?.user

    if (!user || user.email_confirmed_at) {
      // Already confirmed or not found — return success to not reveal info
      return NextResponse.json({ success: true })
    }

    const fullName = user.user_metadata?.full_name || email.split('@')[0]

    // Generate new confirmation link
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password: '', // not needed for link generation on existing user
    })

    const confirmUrl = linkData?.properties?.action_link || ''

    // Generate new 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Update app_metadata with new OTP
    await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: {
        ...user.app_metadata,
        signup_otp: otpCode,
        signup_otp_expires: otpExpiresAt,
      },
    })

    // Send email
    await sendResendEmail(email, fullName, confirmUrl, otpCode, log)

    log.info('OTP reenviado', { detail: `user:${user.id} email:${email}` })
    return NextResponse.json({ success: true })
  } catch (err) {
    log.error('Erro em resend-otp', {}, err)
    return NextResponse.json({ error: 'Erro ao reenviar codigo' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendResendEmail(to: string, fullName: string, confirmUrl: string, otpCode: string, log: any): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const FALLBACK_FROM = 'onboarding@resend.dev'

  if (!resendApiKey) return

  const safeName = escapeHtml(fullName)
  const safeUrl = confirmUrl ? encodeURI(confirmUrl) : ''

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #0D9488; padding: 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">Confirme seu Email</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpereCheck - Sistema de Checklists</p>
    </div>
    <div style="padding: 32px 24px; text-align: center;">
      <p style="color: #1e293b; font-size: 16px; margin: 0 0 8px;">Ola, <strong>${safeName}</strong>!</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Use o codigo abaixo para confirmar seu email:
      </p>

      <!-- OTP Code -->
      <div style="background: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 20px; margin: 0 auto 24px; max-width: 280px;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Codigo de verificacao</p>
        <p style="color: #0D9488; font-size: 36px; font-weight: 800; letter-spacing: 8px; margin: 0; font-family: monospace;">${otpCode}</p>
        <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">Valido por 10 minutos</p>
      </div>

      <p style="color: #475569; font-size: 14px; margin: 0 0 16px;">Ou clique no botao abaixo:</p>

      ${safeUrl ? `<a href="${safeUrl}" style="display: inline-block; background: #0D9488; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Confirmar Email
      </a>` : ''}

      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
        Se voce nao solicitou esta conta, ignore este email.
      </p>
    </div>
    <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">OpereCheck - Sistema de Checklists</p>
    </div>
  </div>
</body>
</html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: fromEmail, to: [to], subject: 'Codigo de verificacao - OpereCheck', html }),
  })

  if (res.ok) {
    const result = await res.json()
    log.info('[ResendOTP] Email reenviado', { detail: `to:${to} id:${(result as { id?: string }).id}` })
    return
  }

  if (fromEmail !== FALLBACK_FROM) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FALLBACK_FROM, to: [to], subject: 'Codigo de verificacao - OpereCheck', html }),
    })
  }
}
