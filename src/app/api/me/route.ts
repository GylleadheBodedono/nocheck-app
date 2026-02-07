import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Esta rota busca o perfil do usuário autenticado
// Usa service role key para evitar problemas de RLS
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies()

        // Cria cliente com cookies para verificar sessão
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll() {
                        // Não precisa setar cookies aqui
                    },
                },
            }
        )

        // Verifica se o usuário está autenticado
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        // Usa service role key para buscar dados (bypassa RLS)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Busca usuário
        const { data: userRes, error: userErr } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if (userErr) {
            console.error('[API /me] Erro ao buscar usuario:', userErr)
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        // Busca setores do usuário
        const { data: assignments } = await supabaseAdmin
            .from('user_sectors')
            .select(`
        *,
        sector:sectors(
          *,
          store:stores(*)
        )
      `)
            .eq('user_id', user.id)

        // Busca roles
        const roleSlugs = [...new Set((assignments || []).map((a: any) => a.role))]
        let rolesMap: Record<string, any> = {}

        if (roleSlugs.length > 0) {
            const { data: rolesData } = await supabaseAdmin
                .from('roles')
                .select('*')
                .in('slug', roleSlugs)

            if (rolesData) {
                rolesMap = rolesData.reduce((acc: any, r: any) => ({ ...acc, [r.slug]: r }), {})
            }
        }

        // Monta access
        const access = (assignments || []).map((a: any) => {
            const role = rolesMap[a.role]
            return {
                storeId: a.sector?.store?.id,
                storeName: a.sector?.store?.name || 'Loja',
                sectorId: a.sector_id,
                sectorName: a.sector?.name || 'Setor',
                roleSlug: a.role,
                roleName: role?.name || a.role,
                permissions: (role?.permissions as Record<string, boolean>) || {}
            }
        }).filter((a: any) => a.storeId)

        const profile = { ...userRes, access }

        return NextResponse.json(profile)
    } catch (error) {
        console.error('[API /me] Erro:', error)
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }
}
