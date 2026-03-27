export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'
import type { AcceptInviteApiRequestDTO, AcceptInviteApiResponseDTO } from '@/dtos'

/**
 * POST /api/invites/accept
 * Autenticado — aceita um convite, vinculando o usuario a organizacao.
 * Chama a RPC accept_invite (SECURITY DEFINER) que:
 * 1. Valida token e email match
 * 2. Cria membership em organization_members
 * 3. Seta tenant_id no users
 * 4. Marca invite como aceito
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const { token } = (await request.json()) as AcceptInviteApiRequestDTO

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token obrigatorio' } satisfies AcceptInviteApiResponseDTO,
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await serviceClient.rpc('accept_invite', {
      invite_token: token,
      accepting_user_id: auth.user.id,
    })

    if (error) {
      log.warn('Falha ao aceitar convite', { detail: error.message })
      return NextResponse.json(
        { success: false, error: error.message } satisfies AcceptInviteApiResponseDTO,
        { status: 400 }
      )
    }

    const result = data as { success: boolean; org_id: string; role: string } | null

    log.info('Convite aceito com sucesso', { detail: `user:${auth.user.id} org:${result?.org_id}` })

    const res: AcceptInviteApiResponseDTO = {
      success: true,
      orgId: result?.org_id,
      role: result?.role as AcceptInviteApiResponseDTO['role'],
    }
    return NextResponse.json(res)
  } catch (err) {
    log.error('Erro ao aceitar convite', {}, err)
    return NextResponse.json(
      { success: false, error: 'Erro interno ao aceitar convite' } satisfies AcceptInviteApiResponseDTO,
      { status: 500 }
    )
  }
}
