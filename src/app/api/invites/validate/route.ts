export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authLimiter, getRequestIdentifier } from '@/lib/rateLimit'
import { createRequestLogger } from '@/lib/serverLogger'
import type { ValidateInviteResponseDTO } from '@/dtos'

/**
 * GET /api/invites/validate?token=UUID
 * Publico — valida um token de convite sem exigir autenticacao.
 * Retorna dados basicos do convite (email, role, org) se valido.
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)

  const { success: rateLimitOk } = authLimiter.check(getRequestIdentifier(request))
  if (!rateLimitOk) {
    return NextResponse.json({ valid: false, reason: 'not_found' } satisfies ValidateInviteResponseDTO, { status: 429 })
  }

  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    const res: ValidateInviteResponseDTO = { valid: false, reason: 'not_found' }
    return NextResponse.json(res, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ valid: false, reason: 'not_found' } satisfies ValidateInviteResponseDTO, { status: 500 })
  }

  try {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await serviceClient.rpc('validate_invite_token', {
      invite_token: token,
    })

    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      log.info('Token de convite invalido ou expirado', { detail: token })
      const res: ValidateInviteResponseDTO = { valid: false, reason: 'not_found' }
      return NextResponse.json(res)
    }

    const invite = Array.isArray(data) ? data[0] : data

    const res: ValidateInviteResponseDTO = {
      valid: true,
      email: invite.email,
      role: invite.role,
      orgName: invite.org_name,
    }
    return NextResponse.json(res)
  } catch (err) {
    log.error('Erro ao validar token de convite', {}, err)
    const res: ValidateInviteResponseDTO = { valid: false, reason: 'not_found' }
    return NextResponse.json(res, { status: 500 })
  }
}
