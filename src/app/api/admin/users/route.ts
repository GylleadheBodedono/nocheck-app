export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { getSupabaseAdmin } from '@/lib/stripe'
import { escapeHtml } from '@/lib/validation'
import { createRequestLogger } from '@/lib/serverLogger'

// ── Route Handlers ──

/**
 * Syncs `auth.users` with `public.users` and returns the full user list.
 *
 * `GET /api/admin/users`
 *
 * Users that exist in auth but not in public are inserted automatically.
 * Returns users with their store, function, sector, and multi-store assignments.
 *
 * @requires Admin authentication via `verifyApiAuth`
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const supabase = getSupabaseAdmin()

    // Obter tenant_id do admin logado para isolamento
    const { data: adminProfile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', auth.user.id)
      .single()

    const tenantId = adminProfile?.tenant_id
    if (!tenantId) {
      return NextResponse.json({ error: 'Usuario sem organizacao' }, { status: 403 })
    }

    // Fetch all auth users
    const { data: authList, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      log.error('Erro ao listar auth users', {}, authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Fetch existing public.users IDs (filtrado por tenant)
    const { data: publicUsers } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)

    const publicIds = new Set((publicUsers || []).map(u => u.id))

    // Insert missing users (exist in auth but not in public — apenas os do mesmo tenant)
    const tenantAuthIds = new Set(
      (await supabase.from('organization_members').select('user_id').eq('organization_id', tenantId)).data?.map(m => m.user_id) || []
    )
    const missing = authList.users.filter(u => tenantAuthIds.has(u.id) && !publicIds.has(u.id))

    for (const authUser of missing) {
      const name = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuario'
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUser.id,
          email: authUser.email || '',
          full_name: name,
          is_active: true,
          is_admin: false,
          tenant_id: tenantId,
        })

      if (insertError) {
        log.error('Erro ao sincronizar usuario', { email: authUser.email }, insertError)
      } else {
        log.info('Usuario sincronizado', { email: authUser.email })
      }
    }

    // Return full list with relations (FILTRADO por tenant_id)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        *,
        store:stores!users_store_id_fkey(*),
        function_ref:functions!users_function_id_fkey(*),
        sector:sectors!users_sector_id_fkey(*),
        user_stores(
          id,
          store_id,
          sector_id,
          is_primary,
          created_at,
          store:stores(*),
          sector:sectors(*)
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    return NextResponse.json(
      { users, synced: missing.length },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    log.error('Erro inesperado em GET /api/admin/users', {}, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

/**
 * Creates a new user in `auth.users` and configures their profile.
 *
 * `POST /api/admin/users` with body containing user details.
 *
 * Flow:
 * 1. Checks the organization's user limit
 * 2. Creates the auth user (auto-confirmed or with email confirmation)
 * 3. Updates the profile in `public.users`
 * 4. Inserts store assignments in `user_stores`
 *
 * When `autoConfirm` is false, sends a confirmation email via Resend.
 *
 * @requires Admin authentication via `verifyApiAuth`
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { email, password, fullName, phone, isAdmin, isTech, autoConfirm, storeId, functionId, sectorId, storeAssignments, redirectTo } = body as {
      email: string
      password: string
      fullName: string
      phone?: string
      isAdmin: boolean
      isTech?: boolean
      autoConfirm?: boolean
      storeId?: number
      functionId?: number
      sectorId?: number
      storeAssignments?: { store_id: number; sector_id: number | null; is_primary: boolean }[]
      redirectTo?: string
    }

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, senha e nome sao obrigatorios' },
        { status: 400 }
      )
    }

    // ── Plan User Limit Check ──

    const adminClient = getSupabaseAdmin()

    const { data: memberData } = await adminClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', auth.user.id)
      .single()

    if (memberData?.organization_id) {
      const { data: org } = await adminClient
        .from('organizations')
        .select('plan, max_users')
        .eq('id', memberData.organization_id)
        .single()

      if (org) {
        const { count } = await adminClient
          .from('users')
          .select('id', { count: 'exact', head: true })

        const currentUsers = count || 0
        const maxUsers = org.max_users || 5

        if (currentUsers >= maxUsers) {
          return NextResponse.json(
            { error: `Limite de usuarios atingido (${currentUsers}/${maxUsers}). Faca upgrade do plano para adicionar mais.` },
            { status: 403 }
          )
        }
      }
    }

    // ── Create Auth User ──

    let userId: string

    if (autoConfirm) {
      const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (adminError) {
        log.error('Erro no admin.createUser (auto-confirm)', { email }, adminError)
        return NextResponse.json({ error: adminError.message }, { status: 400 })
      }

      if (!adminData.user) {
        return NextResponse.json({ error: 'Erro ao criar usuario' }, { status: 500 })
      }

      userId = adminData.user.id
    } else {
      // Create user with unconfirmed email, then send confirmation via Resend
      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      })

      if (createError) {
        log.error('Erro no admin.createUser (sem confirm)', { email }, createError)
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      if (!userData.user) {
        return NextResponse.json({ error: 'Erro ao criar usuario' }, { status: 500 })
      }

      userId = userData.user.id

      // Send confirmation email
      try {
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: 'signup',
          email,
          password,
          options: { redirectTo: redirectTo || undefined },
        })

        if (linkError) {
          log.warn('Erro ao gerar link de confirmacao', { email })
        } else if (linkData?.properties?.action_link) {
          await sendConfirmationEmail(email, fullName, linkData.properties.action_link)
        }
      } catch {
        log.warn('Erro no fluxo de email de confirmacao', { email })
      }
    }

    // ── Update Profile & Store Assignments ──

    const supabase = getSupabaseAdmin()

    // Build store assignments from new format or legacy fields
    let assignments: { store_id: number; sector_id: number | null; is_primary: boolean }[] = []
    if (storeAssignments && storeAssignments.length > 0) {
      assignments = storeAssignments
    } else if (storeId) {
      assignments = [{ store_id: storeId, sector_id: sectorId || null, is_primary: true }]
    }

    const primary = assignments.find(a => a.is_primary) || assignments[0] || null

    const { error: profileError } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        phone: phone || null,
        is_admin: isAdmin,
        is_tech: isTech || false,
        store_id: isAdmin ? null : (primary?.store_id || null),
        function_id: isAdmin ? null : (functionId || null),
        sector_id: isAdmin ? null : (primary?.sector_id || null),
      })
      .eq('id', userId)

    if (profileError) {
      log.error('Erro ao atualizar perfil', { userId }, profileError)
    }

    if (assignments.length > 0 && !isAdmin) {
      const rows = assignments.map(a => ({
        user_id: userId,
        store_id: a.store_id,
        sector_id: a.sector_id,
        is_primary: a.is_primary,
      }))

      const { error: storesError } = await supabase
        .from('user_stores')
        .insert(rows)

      if (storesError) {
        log.error('Erro ao inserir user_stores', { userId }, storesError)
      }
    }

    return NextResponse.json({
      success: true,
      needsConfirmation: !autoConfirm,
      user: { id: userId, email },
    })
  } catch (error) {
    log.error('Erro inesperado em POST /api/admin/users', {}, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// ── Email Helpers ──

/**
 * Sends a confirmation email to a newly created user via the Resend API.
 * Falls back to `onboarding@resend.dev` if the configured sender domain fails.
 */
async function sendConfirmationEmail(email: string, fullName: string, confirmUrl: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

  if (!resendApiKey) {
    console.warn('[API Users] RESEND_API_KEY nao configurada, email nao enviado')
    return
  }

  const FALLBACK_FROM = 'onboarding@resend.dev'
  const emailHtml = buildConfirmationEmailHtml(fullName, confirmUrl)

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: 'Confirme seu email - OpereCheck',
      html: emailHtml,
    }),
  })

  if (emailRes.ok) {
    const result = await emailRes.json()
    console.log('[API Users] Email de confirmacao enviado para:', email, 'from:', fromEmail, 'id:', (result as { id?: string }).id)
    return
  }

  // Fallback: try default sender if custom domain failed
  if (fromEmail !== FALLBACK_FROM) {
    console.warn(`[API Users] Falha com ${fromEmail}, tentando fallback ${FALLBACK_FROM}...`)
    const fallbackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FALLBACK_FROM,
        to: [email],
        subject: 'Confirme seu email',
        html: emailHtml,
      }),
    })

    if (fallbackRes.ok) {
      const result = await fallbackRes.json()
      console.log('[API Users] Email enviado via fallback para:', email, 'id:', (result as { id?: string }).id)
    } else {
      const errData = await fallbackRes.json().catch(() => ({}))
      console.warn('[API Users] Fallback tambem falhou:', errData)
    }
  } else {
    const errData = await emailRes.json().catch(() => ({}))
    console.warn('[API Users] Falha ao enviar email via Resend:', errData)
  }
}

/**
 * Builds the HTML template for the email confirmation message.
 * Uses `escapeHtml` to prevent XSS in user-supplied values.
 */
function buildConfirmationEmailHtml(userName: string, confirmUrl: string, appName = 'OpereCheck', primaryColor = '#0D9488'): string {
  const safeName = escapeHtml(userName)
  const safeAppName = escapeHtml(appName)
  const safeUrl = encodeURI(confirmUrl)
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: ${primaryColor}; padding: 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">Confirme seu Email</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${safeAppName} - Sistema de Checklists</p>
    </div>
    <div style="padding: 32px 24px; text-align: center;">
      <p style="color: #1e293b; font-size: 16px; margin: 0 0 8px;">Ola, <strong>${safeName}</strong>!</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Sua conta foi criada no ${safeAppName}. Clique no botao abaixo para confirmar seu email e ativar sua conta.
      </p>
      <a href="${safeUrl}" style="display: inline-block; background: ${primaryColor}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Confirmar Email
      </a>
      <p style="color: #94a3b8; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
        Se voce nao solicitou esta conta, ignore este email.
      </p>
    </div>
    <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">${safeAppName} - Sistema de Checklists</p>
    </div>
  </div>
</body>
</html>`
}
