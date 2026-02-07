import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// GET /api/dashboard/stats - Retorna estatísticas de checklists
export async function GET() {
    try {
        const cookieStore = await cookies()

        // Verifica autenticação
        const supabaseAuth = createServerClient(
            supabaseUrl,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll() { },
                },
            }
        )

        const { data: { user } } = await supabaseAuth.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // Cliente admin para queries
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Busca o perfil do usuário para verificar se é admin
        const { data: userProfile } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single()

        const isAdmin = userProfile?.is_admin ?? false

        // Datas para filtros
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

        // Total de checklists
        const { count: total } = await supabase
            .from('checklists')
            .select('id', { count: 'exact', head: true })

        // Checklists de hoje
        const { count: today } = await supabase
            .from('checklists')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayStart)

        // Checklists da semana
        const { count: week } = await supabase
            .from('checklists')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', weekStart)

        // Checklists do mês
        const { count: month } = await supabase
            .from('checklists')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', monthStart)

        // Pendentes de sincronização
        const { count: pendingSync } = await supabase
            .from('checklists')
            .select('id', { count: 'exact', head: true })
            .eq('sync_status', 'pending')

        // Templates ativos
        const { count: templates } = await supabase
            .from('checklist_templates')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)

        // Lojas ativas
        const { count: stores } = await supabase
            .from('stores')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true)

        return NextResponse.json({
            total: total || 0,
            today: today || 0,
            week: week || 0,
            month: month || 0,
            pendingSync: pendingSync || 0,
            templates: templates || 0,
            stores: stores || 0,
            isAdmin,
        })

    } catch (error) {
        console.error('[Dashboard Stats] Erro:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            total: 0,
            today: 0,
            week: 0,
            month: 0,
            pendingSync: 0,
            templates: 0,
            stores: 0,
        }, { status: 500 })
    }
}
