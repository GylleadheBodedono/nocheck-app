import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Verifica o caller: retorna { isAdmin, isManager } ou null se nao autenticado
 */
async function getCallerRole(request: NextRequest): Promise<{ isAdmin: boolean; isManager: boolean } | null> {
  const authHeader = request.headers.get('authorization')
  const cookieHeader = request.headers.get('cookie')

  // Try to get user from auth header or cookies
  const userClient = createClient(supabaseUrl, supabaseAnonKey)

  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await userClient.auth.getUser(token)
    if (user) {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
      const { data: profile } = await serviceClient
        .from('users')
        .select('is_admin, is_manager')
        .eq('id', user.id)
        .single()
      return { isAdmin: profile?.is_admin || false, isManager: profile?.is_manager || false }
    }
  }

  // If no auth header, try cookies (for browser requests)
  if (cookieHeader) {
    // Extract sb-*-auth-token from cookies
    const tokenMatch = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/)
    if (tokenMatch) {
      try {
        const decoded = decodeURIComponent(tokenMatch[1])
        const parsed = JSON.parse(decoded)
        const accessToken = parsed?.[0] || parsed?.access_token
        if (accessToken) {
          const { data: { user } } = await userClient.auth.getUser(accessToken)
          if (user) {
            const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
            const { data: profile } = await serviceClient
              .from('users')
              .select('is_admin, is_manager')
              .eq('id', user.id)
              .single()
            return { isAdmin: profile?.is_admin || false, isManager: profile?.is_manager || false }
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  return null
}

/**
 * PUT /api/admin/users/[id]
 * Atualiza perfil do usuario e seus vínculos com lojas (user_stores)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Verify caller
    const caller = await getCallerRole(request)
    if (caller && !caller.isAdmin && caller.isManager) {
      // Manager cannot set isAdmin or isManager
      if (body.isAdmin === true || body.isManager === true) {
        return NextResponse.json(
          { error: 'Gerentes nao podem promover usuarios a admin ou gerente' },
          { status: 403 }
        )
      }
    }

    const { fullName, phone, isAdmin, isActive, isManager, functionId, storeAssignments } = body as {
      fullName: string
      phone?: string | null
      isAdmin: boolean
      isActive: boolean
      isManager?: boolean
      functionId?: number | null
      storeAssignments?: { store_id: number; sector_id: number | null; is_primary: boolean }[]
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Loja primária para manter users.store_id sincronizado
    const assignments = (!isAdmin && storeAssignments) ? storeAssignments : []
    const primary = assignments.find(a => a.is_primary) || assignments[0] || null

    // Atualiza perfil em public.users
    const { error: profileError } = await supabase
      .from('users')
      .update({
        full_name: fullName,
        phone: phone || null,
        is_admin: isAdmin,
        is_active: isActive,
        is_manager: isAdmin ? false : (isManager || false),
        function_id: isAdmin ? null : (functionId || null),
        store_id: isAdmin ? null : (primary?.store_id || null),
        sector_id: isAdmin ? null : (primary?.sector_id || null),
      })
      .eq('id', userId)

    if (profileError) {
      console.error('[API Users] Erro ao atualizar perfil:', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }

    // Substituir vínculos de lojas: deletar todos e re-inserir
    const { error: deleteError } = await supabase
      .from('user_stores')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[API Users] Erro ao limpar user_stores:', deleteError)
    }

    if (assignments.length > 0) {
      const rows = assignments.map(a => ({
        user_id: userId,
        store_id: a.store_id,
        sector_id: a.sector_id,
        is_primary: a.is_primary,
      }))

      const { error: insertError } = await supabase
        .from('user_stores')
        .insert(rows)

      if (insertError) {
        console.error('[API Users] Erro ao inserir user_stores:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Users] Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Deleta usuario do auth.users (CASCADE deleta de public.users automaticamente)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    // Only admins can delete users
    const caller = await getCallerRole(request)
    if (!caller?.isAdmin) {
      return NextResponse.json(
        { error: 'Apenas administradores podem excluir usuarios' },
        { status: 403 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Deleta do auth.users - CASCADE cuida do public.users e user_store_roles
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      console.error('[API Users] Erro ao deletar usuario:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API Users] Erro:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
