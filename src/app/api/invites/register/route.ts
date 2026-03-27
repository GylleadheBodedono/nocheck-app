export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter, getRequestIdentifier } from '@/lib/rateLimit'
import { createRequestLogger } from '@/lib/serverLogger'
import { escapeHtml } from '@/lib/validation'

/**
 * POST /api/invites/register
 * Public — creates a user account for invite-based employee signup.
 *
 * Uses admin.createUser (no auto-email) + admin.generateLink to get
 * confirmation link, then generates a 6-digit OTP and sends a single
 * custom email via Resend containing BOTH the link and the OTP code.
 *
 * Body: { email, password, fullName, phone, cpf, inviteToken }
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  const { success: rateLimitOk } = authLimiter.check(getRequestIdentifier(request))
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  try {
    const { email, password, fullName, phone, cpf, inviteToken } = await request.json()

    if (!email || !password || !fullName || !inviteToken) {
      return NextResponse.json({ error: 'Campos obrigatorios: email, password, fullName, inviteToken' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Validate invite token
    const { data: inviteData, error: inviteError } = await adminClient.rpc('validate_invite_token', {
      invite_token: inviteToken,
    })

    const invite = Array.isArray(inviteData) ? inviteData[0] : inviteData
    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Convite invalido ou expirado' }, { status: 400 })
    }

    // Verify email matches the invite
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Email nao corresponde ao convite' }, { status: 400 })
    }

    // 2. Create user WITHOUT sending auto-email
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName,
        phone: phone?.replace(/\D/g, '') || null,
        user_type: 'funcionario',
        cpf: cpf?.replace(/\D/g, '') || null,
      },
    })

    if (createError) {
      log.error('Erro ao criar usuario via invite', { detail: createError.message })
      if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
        return NextResponse.json({ error: 'Este email ja esta cadastrado. Tente fazer login.' }, { status: 400 })
      }
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!userData.user) {
      return NextResponse.json({ error: 'Erro ao criar usuario' }, { status: 500 })
    }

    const userId = userData.user.id

    // 3. Generate confirmation link
    const { data: linkData } = await adminClient.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
    })

    const confirmUrl = linkData?.properties?.action_link || ''

    // 4. Generate 6-digit OTP and store in invite record
    const otpCode = String(Math.floor(100000 + Math.random() * 900000))
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // Store OTP in a metadata field on the user (admin API can set app_metadata)
    await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { signup_otp: otpCode, signup_otp_expires: otpExpiresAt },
    })

    // 5. Send ONE email with both link and OTP
    await sendSignupEmail(email, fullName, confirmUrl, otpCode, log)

    log.info('Invite signup: user created, email sent', { detail: `user:${userId} email:${email}` })

    return NextResponse.json({
      success: true,
      needsVerification: true,
      userId,
    })
  } catch (err) {
    log.error('Erro em invite register', {}, err)
    return NextResponse.json({ error: 'Erro interno ao criar conta' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSignupEmail(to: string, fullName: string, confirmUrl: string, otpCode: string, log: any): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const FALLBACK_FROM = 'onboarding@resend.dev'

  if (!resendApiKey) {
    log.warn('[InviteRegister] RESEND_API_KEY nao configurada')
    return
  }

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
        Sua conta foi criada no OpereCheck. Use o codigo abaixo para confirmar seu email:
      </p>

      <!-- OTP Code -->
      <div style="background: #f0fdfa; border: 2px solid #0D9488; border-radius: 12px; padding: 20px; margin: 0 auto 24px; max-width: 280px;">
        <p style="color: #64748b; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Codigo de verificacao</p>
        <p style="color: #0D9488; font-size: 36px; font-weight: 800; letter-spacing: 8px; margin: 0; font-family: monospace;">${otpCode}</p>
        <p style="color: #94a3b8; font-size: 11px; margin: 8px 0 0;">Valido por 10 minutos</p>
      </div>

      <p style="color: #475569; font-size: 14px; margin: 0 0 16px;">Ou clique no botao abaixo:</p>

      <!-- Confirm Link -->
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
    body: JSON.stringify({ from: fromEmail, to: [to], subject: 'Confirme seu email - OpereCheck', html }),
  })

  if (res.ok) {
    const result = await res.json()
    log.info('[InviteRegister] Email enviado', { detail: `to:${to} id:${(result as { id?: string }).id}` })
    return
  }

  // Fallback sender
  if (fromEmail !== FALLBACK_FROM) {
    const fallbackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FALLBACK_FROM, to: [to], subject: 'Confirme seu email - OpereCheck', html }),
    })
    if (fallbackRes.ok) {
      log.info('[InviteRegister] Email enviado via fallback', { detail: `to:${to}` })
    }
  }
}
