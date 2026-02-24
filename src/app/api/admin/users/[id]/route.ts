export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * PUT /api/admin/users/[id]
 * Atualiza perfil do usuario e seus vínculos com lojas (user_stores)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    const body = await request.json()

    const { fullName, phone, isAdmin, isActive, functionId, storeAssignments } = body as {
      fullName: string
      phone?: string | null
      isAdmin: boolean
      isActive: boolean
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
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuario e obrigatorio' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Limpar TODAS as referencias a public.users(id) antes de deletar
    // (necessario porque FKs podem nao ter ON DELETE CASCADE/SET NULL)
    const adminUserId = auth.user.id

    // 1. Deletar registros filhos (junction tables)
    await Promise.allSettled([
      supabase.from('user_stores').delete().eq('user_id', userId),
      supabase.from('user_store_roles').delete().eq('user_id', userId),
      supabase.from('notifications').delete().eq('user_id', userId),
    ])

    // 2. Nullificar FKs que referenciam public.users(id)
    await Promise.allSettled([
      supabase.from('activity_log').update({ user_id: null }).eq('user_id', userId),
      supabase.from('checklist_templates').update({ created_by: null }).eq('created_by', userId),
      supabase.from('template_visibility').update({ assigned_by: null }).eq('assigned_by', userId),
      supabase.from('checklists').update({ validated_by: null }).eq('validated_by', userId),
      supabase.from('checklist_responses').update({ answered_by: null }).eq('answered_by', userId),
      supabase.from('attachments').update({ uploaded_by: null }).eq('uploaded_by', userId),
      supabase.from('checklist_justifications').update({ justified_by: null }).eq('justified_by', userId),
      supabase.from('user_store_roles').update({ assigned_by: null }).eq('assigned_by', userId),
    ])

    // 3. checklists.created_by pode ser NOT NULL — tenta null, senao reatribui ao admin
    const { error: nullErr } = await supabase
      .from('checklists')
      .update({ created_by: null })
      .eq('created_by', userId)

    if (nullErr) {
      await supabase
        .from('checklists')
        .update({ created_by: adminUserId })
        .eq('created_by', userId)
    }

    // 4. Agora deletar do auth.users (CASCADE deleta public.users sem bloqueio)
    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      console.error('[API Users] Erro ao deletar usuario:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao excluir usuario' },
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
