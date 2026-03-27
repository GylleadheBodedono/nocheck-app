export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'
import { buildInviteEmailHtml } from '@/lib/emailTemplateEngine'
import type { BulkInviteRequestDTO, BulkInviteResponseDTO } from '@/dtos'

const VALID_ROLES = ['admin', 'manager', 'member', 'viewer']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/admin/invites
 * Admin — cria convites individuais ou em massa e envia emails.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const body = (await request.json()) as BulkInviteRequestDTO

    if (!body.invites || !Array.isArray(body.invites) || body.invites.length === 0) {
      return NextResponse.json(
        { created: 0, errors: [{ email: '', reason: 'Lista de convites vazia' }] } satisfies BulkInviteResponseDTO,
        { status: 400 }
      )
    }

    if (body.invites.length > 100) {
      return NextResponse.json(
        { created: 0, errors: [{ email: '', reason: 'Maximo de 100 convites por vez' }] } satisfies BulkInviteResponseDTO,
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Resolve org from the admin's membership
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('organization_id, organizations:organization_id(id, name, max_users)')
      .eq('user_id', auth.user.id)
      .limit(1)
      .single()

    if (!membership?.organization_id) {
      return NextResponse.json(
        { created: 0, errors: [{ email: '', reason: 'Organizacao nao encontrada' }] } satisfies BulkInviteResponseDTO,
        { status: 400 }
      )
    }

    const orgId = membership.organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = membership.organizations as any
    const orgName = org?.name || 'Sua empresa'
    const maxUsers = org?.max_users || 5

    // Count current members + pending invites
    const [{ count: memberCount }, { count: pendingCount }] = await Promise.all([
      serviceClient
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      serviceClient
        .from('invites')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', orgId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString()),
    ])

    const currentTotal = (memberCount || 0) + (pendingCount || 0)
    const available = maxUsers - currentTotal

    if (available <= 0) {
      return NextResponse.json(
        { created: 0, errors: [{ email: '', reason: `Limite de usuarios atingido (${maxUsers}). Faca upgrade do plano.` }] } satisfies BulkInviteResponseDTO,
        { status: 400 }
      )
    }

    // Get admin name for invite email
    const { data: adminProfile } = await serviceClient
      .from('users')
      .select('full_name')
      .eq('id', auth.user.id)
      .single()
    const inviterName = adminProfile?.full_name || auth.user.email

    const created: string[] = []
    const errors: Array<{ email: string; reason: string }> = []

    const invitesToProcess = body.invites.slice(0, available)
    const overLimit = body.invites.slice(available)

    for (const item of overLimit) {
      errors.push({ email: item.email, reason: 'Limite de usuarios atingido' })
    }

    for (const item of invitesToProcess) {
      const email = item.email?.trim()?.toLowerCase()
      const role = item.role || 'member'

      if (!email || !EMAIL_REGEX.test(email)) {
        errors.push({ email: email || '', reason: 'Email invalido' })
        continue
      }

      if (!VALID_ROLES.includes(role)) {
        errors.push({ email, reason: `Role invalido: ${role}` })
        continue
      }

      // Check if user already exists in the org
      const { data: existingUser } = await serviceClient
        .from('users')
        .select('id')
        .eq('email', email)
        .eq('tenant_id', orgId)
        .maybeSingle()

      if (existingUser) {
        errors.push({ email, reason: 'Usuario ja faz parte da organizacao' })
        continue
      }

      // Insert invite
      const { data: invite, error: insertError } = await serviceClient
        .from('invites')
        .insert({
          tenant_id: orgId,
          email,
          role,
          invited_by: auth.user.id,
        })
        .select('token')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          errors.push({ email, reason: 'Convite pendente ja existe para este email' })
        } else {
          errors.push({ email, reason: insertError.message })
        }
        continue
      }

      created.push(email)

      // Send invite email (fire and forget — don't block on failure)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.operecheck.com'
      const inviteUrl = `${appUrl}/cadastro?invite=${invite.token}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')

      const { html, subject } = buildInviteEmailHtml({
        org_name: orgName,
        inviter_name: inviterName,
        role_label: getRoleLabel(role),
        invite_url: inviteUrl,
        expires_at: expiresAt,
        app_name: 'OpereCheck',
      })

      sendInviteEmail(email, subject, html, log).catch(() => {
        // Email failure is non-blocking
      })
    }

    log.info('Convites criados', { detail: `created:${created.length} errors:${errors.length}` })

    const res: BulkInviteResponseDTO = { created: created.length, errors }
    return NextResponse.json(res)
  } catch (err) {
    log.error('Erro ao criar convites', {}, err)
    return NextResponse.json(
      { created: 0, errors: [{ email: '', reason: 'Erro interno' }] } satisfies BulkInviteResponseDTO,
      { status: 500 }
    )
  }
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    member: 'Membro',
    viewer: 'Visualizador',
  }
  return labels[role] || role
}

async function sendInviteEmail(
  to: string,
  subject: string,
  html: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: any
): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const FALLBACK_FROM = 'onboarding@resend.dev'

  if (!resendApiKey) {
    log.warn('[Invites] RESEND_API_KEY nao configurada')
    return
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  })

  if (emailRes.ok) {
    const result = await emailRes.json()
    log.info('[Invites] Email de convite enviado', { detail: `to:${to} id:${(result as { id?: string }).id}` })
    return
  }

  // Fallback
  if (fromEmail !== FALLBACK_FROM) {
    const fallbackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FALLBACK_FROM, to: [to], subject, html }),
    })
    if (fallbackRes.ok) {
      log.info('[Invites] Email enviado via fallback', { detail: `to:${to}` })
    } else {
      log.warn('[Invites] Fallback tambem falhou', { detail: to })
    }
  }
}
