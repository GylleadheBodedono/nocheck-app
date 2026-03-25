export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/admin/users
 * Sincroniza auth.users com public.users e retorna a lista completa
 * Usuarios que existem no auth mas nao no public sao inseridos automaticamente
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Busca todos usuarios do auth.users
    const { data: authList, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      log.error('Erro ao listar auth users', {}, authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // 2. Busca todos usuarios do public.users
    const { data: publicUsers } = await supabase
      .from('users')
      .select('id')

    const publicIds = new Set((publicUsers || []).map(u => u.id))

    // 3. Insere usuarios que existem no auth mas nao no public
    const missing = authList.users.filter(u => !publicIds.has(u.id))

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
        })

      if (insertError) {
        log.error('Erro ao sincronizar usuario', { email: authUser.email }, insertError)
      } else {
        log.info('Usuario sincronizado', { email: authUser.email })
      }
    }

    // 4. Retorna lista completa de public.users com loja/funcao/setor + multi-lojas
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
 * POST /api/admin/users
 * Cria usuario no auth.users (trigger cria em public.users automaticamente)
 * Depois atualiza o perfil e insere os roles
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

    // 1. Criar usuario - auto-confirm usa admin API, senao usa signUp normal
    let userId: string

    if (autoConfirm) {
      // Auto-confirm: usa admin API para criar usuario ja confirmado
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: adminData, error: adminError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })

      if (adminError) {
        log.error('Erro no admin.createUser (auto-confirm)', { email }, adminError)
        return NextResponse.json(
          { error: adminError.message },
          { status: 400 }
        )
      }

      if (!adminData.user) {
        return NextResponse.json(
          { error: 'Erro ao criar usuario' },
          { status: 500 }
        )
      }

      userId = adminData.user.id
    } else {
      // Sem auto-confirm: cria usuario com email NAO confirmado + envia email via Resend
      const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      })

      if (createError) {
        log.error('Erro no admin.createUser (sem confirm)', { email }, createError)
        return NextResponse.json(
          { error: createError.message },
          { status: 400 }
        )
      }

      if (!userData.user) {
        return NextResponse.json(
          { error: 'Erro ao criar usuario' },
          { status: 500 }
        )
      }

      userId = userData.user.id

      // Gerar link de confirmacao de email
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
          // Enviar email de confirmacao diretamente via Resend API
          const confirmUrl = linkData.properties.action_link
          const emailHtml = buildConfirmationEmailHtml(fullName, confirmUrl)
          const resendApiKey = process.env.RESEND_API_KEY
          const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

          if (resendApiKey) {
            const FALLBACK_FROM = 'onboarding@resend.dev'
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
              log.info('Email de confirmacao enviado', { email, from: fromEmail, emailId: (result as { id?: string }).id })
            } else if (fromEmail !== FALLBACK_FROM) {
              // Fallback: dominio customizado falhou, tenta com onboarding@resend.dev
              log.warn('Falha com dominio customizado, tentando fallback', { email, from: fromEmail, fallback: FALLBACK_FROM })
              const fallbackRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendApiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: FALLBACK_FROM,
                  to: [email],
                  subject: 'Confirme seu email - OpereCheck',
                  html: emailHtml,
                }),
              })

              if (fallbackRes.ok) {
                const result = await fallbackRes.json()
                log.info('Email enviado via fallback', { email, emailId: (result as { id?: string }).id })
              } else {
                const errData = await fallbackRes.json().catch(() => ({}))
                log.warn('Fallback tambem falhou ao enviar email', { email, error: JSON.stringify(errData) })
              }
            } else {
              const errData = await emailRes.json().catch(() => ({}))
              log.warn('Falha ao enviar email via Resend', { email, error: JSON.stringify(errData) })
            }
          } else {
            log.warn('RESEND_API_KEY nao configurada, email de confirmacao nao enviado', { email })
          }
        }
      } catch (linkErr) {
        log.warn('Erro no fluxo de email de confirmacao', { email })
      }
    }

    // 2. Service role para atualizar perfil e roles
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Monta lista de lojas: novo formato (storeAssignments) ou legado (storeId/sectorId)
    let assignments: { store_id: number; sector_id: number | null; is_primary: boolean }[] = []
    if (storeAssignments && storeAssignments.length > 0) {
      assignments = storeAssignments
    } else if (storeId) {
      assignments = [{ store_id: storeId, sector_id: sectorId || null, is_primary: true }]
    }

    // Loja primária para manter users.store_id sincronizado
    const primary = assignments.find(a => a.is_primary) || assignments[0] || null

    // Atualiza perfil em public.users (trigger ja criou o registro)
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

    // Insere vínculos em user_stores
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
      user: {
        id: userId,
        email,
      },
    })
  } catch (error) {
    log.error('Erro inesperado em POST /api/admin/users', {}, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

// ============================================
// EMAIL HTML BUILDER
// ============================================

function buildConfirmationEmailHtml(userName: string, confirmUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #6366f1; padding: 24px; color: white; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">Confirme seu Email</h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">OpereCheck - Sistema de Checklists</p>
    </div>
    <div style="padding: 32px 24px; text-align: center;">
      <p style="color: #1e293b; font-size: 16px; margin: 0 0 8px;">Ola, <strong>${userName}</strong>!</p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
        Sua conta foi criada no OpereCheck. Clique no botao abaixo para confirmar seu email e ativar sua conta.
      </p>
      <a href="${confirmUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
        Confirmar Email
      </a>
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
}
