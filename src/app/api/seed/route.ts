import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST /api/seed - Popula o banco com dados de teste
export async function POST() {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const results: string[] = []

    try {
        // 1. Criar lojas
        const { data: stores, error: storesErr } = await supabase
            .from('stores')
            .upsert([
                { name: 'Loja Centro', cnpj: '12345678000101', address: 'Rua Principal, 100 - Centro', is_active: true },
                { name: 'Loja Norte', cnpj: '12345678000102', address: 'Av. Norte, 200 - Zona Norte', is_active: true },
                { name: 'Loja Sul', cnpj: '12345678000103', address: 'Av. Sul, 300 - Zona Sul', is_active: true },
                { name: 'Loja Leste', cnpj: '12345678000104', address: 'Rua Leste, 400 - Zona Leste', is_active: true },
                { name: 'Loja Oeste', cnpj: '12345678000105', address: 'Av. Oeste, 500 - Zona Oeste', is_active: true },
                { name: 'Loja Shopping', cnpj: '12345678000106', address: 'Shopping Center, Loja 10', is_active: true },
                { name: 'Loja Matriz', cnpj: '12345678000107', address: 'Praça Central, 1', is_active: true },
                { name: 'Loja Filial', cnpj: '12345678000108', address: 'Av. Secundária, 50', is_active: true },
            ], { onConflict: 'cnpj' })
            .select()

        if (storesErr) throw storesErr
        results.push(`✅ ${stores?.length || 0} lojas criadas`)

        // 2. Buscar lojas e criar setores
        const { data: allStores } = await supabase.from('stores').select('id, name')

        for (const store of allStores || []) {
            await supabase.from('sectors').upsert([
                { store_id: store.id, name: 'Cozinha', is_active: true },
                { store_id: store.id, name: 'Salão', is_active: true },
            ], { ignoreDuplicates: true })
        }
        results.push(`✅ Setores criados para ${allStores?.length || 0} lojas`)

        // 3. Criar roles
        await supabase.from('roles').upsert([
            { slug: 'gerente', name: 'Gerente', permissions: { view: true, edit: true, delete: true, create: true, approve: true } },
            { slug: 'supervisor', name: 'Supervisor', permissions: { view: true, edit: true, delete: false, create: true, approve: true } },
            { slug: 'operador', name: 'Operador', permissions: { view: true, edit: true, delete: false, create: false, approve: false } },
        ], { onConflict: 'slug' })
        results.push('✅ Roles criadas')

        // 4. Criar templates
        const { data: templates } = await supabase
            .from('checklist_templates')
            .upsert([
                { name: 'Abertura de Loja', description: 'Checklist para abertura diária', category: 'operacional', is_active: true },
                { name: 'Fechamento de Loja', description: 'Checklist para fechamento', category: 'operacional', is_active: true },
                { name: 'Higiene - Cozinha', description: 'Verificação de higiene da cozinha', category: 'seguranca', is_active: true },
                { name: 'Higiene - Salão', description: 'Verificação de higiene do salão', category: 'seguranca', is_active: true },
                { name: 'Manutenção Equipamentos', description: 'Checklist de manutenção', category: 'manutencao', is_active: true },
                { name: 'Controle de Estoque', description: 'Inventário de produtos', category: 'gestao', is_active: true },
            ], { onConflict: 'name' })
            .select()
        results.push(`✅ ${templates?.length || 0} templates criados`)

        // 5. Criar campos para templates
        const aberturaTemplate = templates?.find(t => t.name === 'Abertura de Loja')
        const higieneTemplate = templates?.find(t => t.name === 'Higiene - Cozinha')

        if (aberturaTemplate) {
            await supabase.from('template_fields').upsert([
                { template_id: aberturaTemplate.id, name: 'Loja está limpa?', field_type: 'boolean', is_required: true, sort_order: 1 },
                { template_id: aberturaTemplate.id, name: 'Luzes funcionando?', field_type: 'boolean', is_required: true, sort_order: 2 },
                { template_id: aberturaTemplate.id, name: 'Caixa verificado?', field_type: 'boolean', is_required: true, sort_order: 3 },
                { template_id: aberturaTemplate.id, name: 'Observações', field_type: 'text', is_required: false, sort_order: 4 },
            ], { ignoreDuplicates: true })
        }

        if (higieneTemplate) {
            await supabase.from('template_fields').upsert([
                { template_id: higieneTemplate.id, name: 'Superfícies limpas?', field_type: 'boolean', is_required: true, sort_order: 1 },
                { template_id: higieneTemplate.id, name: 'Geladeira organizada?', field_type: 'boolean', is_required: true, sort_order: 2 },
                { template_id: higieneTemplate.id, name: 'Temperatura geladeira', field_type: 'number', is_required: true, sort_order: 3 },
                { template_id: higieneTemplate.id, name: 'Foto do ambiente', field_type: 'photo', is_required: false, sort_order: 4 },
            ], { ignoreDuplicates: true })
        }
        results.push('✅ Campos dos templates configurados')

        // 6. Criar visibilidades
        for (const template of templates || []) {
            for (const store of allStores || []) {
                await supabase.from('template_visibility').upsert({
                    template_id: template.id,
                    store_id: store.id,
                    roles: ['gerente', 'supervisor', 'operador'],
                }, { ignoreDuplicates: true })
            }
        }
        results.push('✅ Visibilidade dos templates configurada')

        return NextResponse.json({
            success: true,
            results,
            summary: {
                stores: allStores?.length || 0,
                templates: templates?.length || 0,
            }
        })

    } catch (error) {
        console.error('[Seed] Erro:', error)
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            results
        }, { status: 500 })
    }
}
