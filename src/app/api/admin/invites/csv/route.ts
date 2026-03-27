export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'
import { buildInviteEmailHtml } from '@/lib/emailTemplateEngine'
import type { CsvInviteResponseDTO } from '@/dtos'

const VALID_ROLES = ['admin', 'manager', 'member', 'viewer']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/admin/invites/csv
 * Admin — recebe um arquivo CSV com emails e roles, cria convites em massa.
 * Formato CSV esperado: email,role (header opcional)
 * Role e opcional — default 'member'
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { created: 0, skipped: 0, errors: [{ line: 0, email: '', reason: 'Arquivo CSV nao encontrado' }] } satisfies CsvInviteResponseDTO,
        { status: 400 }
      )
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())

    if (lines.length === 0) {
      return NextResponse.json(
        { created: 0, skipped: 0, errors: [{ line: 0, email: '', reason: 'Arquivo CSV vazio' }] } satisfies CsvInviteResponseDTO,
        { status: 400 }
      )
    }

    // Detect and skip header row
    const firstLine = lines[0].toLowerCase().trim()
    const hasHeader = firstLine.includes('email') || firstLine.includes('e-mail')
    const dataLines = hasHeader ? lines.slice(1) : lines

    if (dataLines.length === 0) {
      return NextResponse.json(
        { created: 0, skipped: 0, errors: [{ line: 1, email: '', reason: 'CSV contem apenas header' }] } satisfies CsvInviteResponseDTO,
        { status: 400 }
      )
    }

    if (dataLines.length > 100) {
      return NextResponse.json(
        { created: 0, skipped: 0, errors: [{ line: 0, email: '', reason: 'Maximo de 100 linhas por arquivo' }] } satisfies CsvInviteResponseDTO,
        { status: 400 }
      )
    }

    // Parse CSV rows
    const parsed: Array<{ line: number; email: string; role: string }> = []
    const errors: Array<{ line: number; email: string; reason: string }> = []
    const seenEmails = new Set<string>()

    for (let i = 0; i < dataLines.length; i++) {
      const lineNum = hasHeader ? i + 2 : i + 1
      const parts = dataLines[i].split(/[,;]/).map((s) => s.trim().replace(/^["']|["']$/g, ''))
      const email = parts[0]?.toLowerCase()
      // Sanitize CSV injection
      const rawRole = (parts[1] || 'member').replace(/^[=+\-@]/, '').toLowerCase()
      const role = VALID_ROLES.includes(rawRole) ? rawRole : 'member'

      if (!email || !EMAIL_REGEX.test(email)) {
        errors.push({ line: lineNum, email: email || '', reason: 'Email invalido' })
        continue
      }

      if (seenEmails.has(email)) {
        errors.push({ line: lineNum, email, reason: 'Email duplicado no CSV' })
        continue
      }

      seenEmails.add(email)
      parsed.push({ line: lineNum, email, role })
    }

    if (parsed.length === 0) {
      const res: CsvInviteResponseDTO = { created: 0, skipped: 0, errors }
      return NextResponse.json(res)
    }

    // Setup Supabase service client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Get org info
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('organization_id, organizations:organization_id(id, name, max_users)')
      .eq('user_id', auth.user.id)
      .limit(1)
      .single()

    if (!membership?.organization_id) {
      return NextResponse.json(
        { created: 0, skipped: 0, errors: [{ line: 0, email: '', reason: 'Organizacao nao encontrada' }] } satisfies CsvInviteResponseDTO,
        { status: 400 }
      )
    }

    const orgId = membership.organization_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = membership.organizations as any
    const orgName = org?.name || 'Sua empresa'
    const maxUsers = org?.max_users || 5

    // Check limits
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

    // Get admin name
    const { data: adminProfile } = await serviceClient
      .from('users')
      .select('full_name')
      .eq('id', auth.user.id)
      .single()
    const inviterName = adminProfile?.full_name || auth.user.email

    let created = 0
    let skipped = 0

    for (const item of parsed) {
      if (created >= available) {
        errors.push({ line: item.line, email: item.email, reason: 'Limite de usuarios atingido' })
        continue
      }

      // Check if user already in org
      const { data: existingUser } = await serviceClient
        .from('users')
        .select('id')
        .eq('email', item.email)
        .eq('tenant_id', orgId)
        .maybeSingle()

      if (existingUser) {
        errors.push({ line: item.line, email: item.email, reason: 'Usuario ja faz parte da organizacao' })
        skipped++
        continue
      }

      const { data: invite, error: insertError } = await serviceClient
        .from('invites')
        .insert({
          tenant_id: orgId,
          email: item.email,
          role: item.role,
          invited_by: auth.user.id,
        })
        .select('token')
        .single()

      if (insertError) {
        if (insertError.code === '23505') {
          errors.push({ line: item.line, email: item.email, reason: 'Convite pendente ja existe' })
          skipped++
        } else {
          errors.push({ line: item.line, email: item.email, reason: insertError.message })
        }
        continue
      }

      created++

      // Send email (fire and forget)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://app.operecheck.com'
      const inviteUrl = `${appUrl}/cadastro?invite=${invite.token}`
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')

      const roleLabels: Record<string, string> = {
        admin: 'Administrador',
        manager: 'Gerente',
        member: 'Membro',
        viewer: 'Visualizador',
      }

      const { html, subject } = buildInviteEmailHtml({
        org_name: orgName,
        inviter_name: inviterName,
        role_label: roleLabels[item.role] || item.role,
        invite_url: inviteUrl,
        expires_at: expiresAt,
        app_name: 'OpereCheck',
      })

      sendEmail(item.email, subject, html).catch(() => {})
    }

    log.info('CSV convites processado', { detail: `created:${created} skipped:${skipped} errors:${errors.length}` })

    const res: CsvInviteResponseDTO = { created, skipped, errors }
    return NextResponse.json(res)
  } catch (err) {
    log.error('Erro ao processar CSV de convites', {}, err)
    return NextResponse.json(
      { created: 0, skipped: 0, errors: [{ line: 0, email: '', reason: 'Erro interno' }] } satisfies CsvInviteResponseDTO,
      { status: 500 }
    )
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  if (!resendApiKey) return

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  })

  if (!res.ok && fromEmail !== 'onboarding@resend.dev') {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: 'onboarding@resend.dev', to: [to], subject, html }),
    })
  }
}
