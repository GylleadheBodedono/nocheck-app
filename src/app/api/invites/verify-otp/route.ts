export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter, getRequestIdentifier } from '@/lib/rateLimit'
import { createRequestLogger } from '@/lib/serverLogger'

/**
 * POST /api/invites/verify-otp
 * Public — verifies the 6-digit OTP code sent during invite signup.
 *
 * If valid, confirms the user's email via admin API and returns
 * a session (access_token + refresh_token) so the frontend can
 * sign in immediately.
 *
 * Body: { email, otp }
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  const { success: rateLimitOk } = authLimiter.check(getRequestIdentifier(request))
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 })
  }

  try {
    const { email, otp } = await request.json()

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email e codigo OTP sao obrigatorios' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: 'Codigo deve ter 6 digitos' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find user by email via public.users (indexed, reliable), then fetch auth user
    const { data: publicUser } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (!publicUser) {
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(publicUser.id)

    if (authError || !authData?.user) {
      log.error('Usuario existe em public.users mas nao em auth', { detail: publicUser.id })
      return NextResponse.json({ error: 'Usuario nao encontrado' }, { status: 404 })
    }

    const user = authData.user

    // Check OTP from app_metadata
    const storedOtp = user.app_metadata?.signup_otp
    const otpExpires = user.app_metadata?.signup_otp_expires

    if (!storedOtp) {
      return NextResponse.json({ error: 'Nenhum codigo pendente. Solicite um novo.' }, { status: 400 })
    }

    if (otpExpires && new Date(otpExpires) < new Date()) {
      return NextResponse.json({ error: 'Codigo expirado. Solicite um novo.' }, { status: 400 })
    }

    if (storedOtp !== otp) {
      return NextResponse.json({ error: 'Codigo invalido. Verifique e tente novamente.' }, { status: 400 })
    }

    // OTP valid — confirm email and clear OTP
    const { error: confirmError } = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      app_metadata: { ...user.app_metadata, signup_otp: null, signup_otp_expires: null },
    })

    if (confirmError) {
      log.error('Erro ao confirmar email', { detail: confirmError.message })
      return NextResponse.json({ error: 'Erro ao confirmar email' }, { status: 500 })
    }

    log.info('OTP verificado, email confirmado', { detail: `user:${user.id}` })

    return NextResponse.json({ success: true, userId: user.id })
  } catch (err) {
    log.error('Erro em verify-otp', {}, err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
