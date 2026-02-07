import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedDatabase() {
    console.log('🌱 Iniciando seed de dados de teste...\n')

    try {
        // 1. Criar lojas
        console.log('1. Criando lojas...')
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
        console.log(`   ✅ ${stores?.length || 0} lojas criadas/atualizadas`)

        // 2. Buscar lojas para criar setores
        const { data: allStores } = await supabase.from('stores').select('id, name')

        // 3. Criar setores para cada loja
        console.log('2. Criando setores...')
        const sectorsData = allStores?.flatMap(store => [
            { store_id: store.id, name: 'Cozinha', is_active: true },
            { store_id: store.id, name: 'Salão', is_active: true },
        ]) || []

        const { error: sectorsErr } = await supabase
            .from('sectors')
            .upsert(sectorsData, { onConflict: 'store_id,name', ignoreDuplicates: true })

        if (sectorsErr && !sectorsErr.message.includes('duplicate')) throw sectorsErr
        console.log(`   ✅ Setores criados para ${allStores?.length || 0} lojas`)

        // 4. Criar roles
        console.log('3. Criando roles...')
        const { error: rolesErr } = await supabase
            .from('roles')
            .upsert([
                { slug: 'gerente', name: 'Gerente', permissions: { view: true, edit: true, delete: true, create: true, approve: true } },
                { slug: 'supervisor', name: 'Supervisor', permissions: { view: true, edit: true, delete: false, create: true, approve: true } },
                { slug: 'operador', name: 'Operador', permissions: { view: true, edit: true, delete: false, create: false, approve: false } },
            ], { onConflict: 'slug' })

        if (rolesErr) throw rolesErr
        console.log('   ✅ Roles criadas')

        // 5. Criar templates
        console.log('4. Criando templates de checklist...')
        const { data: templates, error: templatesErr } = await supabase
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

        if (templatesErr) throw templatesErr
        console.log(`   ✅ ${templates?.length || 0} templates criados`)

        // 6. Criar campos para template "Abertura de Loja"
        console.log('5. Criando campos dos templates...')
        const aberturaTemplate = templates?.find(t => t.name === 'Abertura de Loja')
        const higieneTemplate = templates?.find(t => t.name === 'Higiene - Cozinha')

        if (aberturaTemplate) {
            await supabase.from('template_fields').upsert([
                { template_id: aberturaTemplate.id, name: 'Loja está limpa?', field_type: 'boolean', is_required: true, sort_order: 1 },
                { template_id: aberturaTemplate.id, name: 'Luzes funcionando?', field_type: 'boolean', is_required: true, sort_order: 2 },
                { template_id: aberturaTemplate.id, name: 'Caixa verificado?', field_type: 'boolean', is_required: true, sort_order: 3 },
                { template_id: aberturaTemplate.id, name: 'Observações', field_type: 'text', is_required: false, sort_order: 4 },
            ], { onConflict: 'template_id,name', ignoreDuplicates: true })
        }

        if (higieneTemplate) {
            await supabase.from('template_fields').upsert([
                { template_id: higieneTemplate.id, name: 'Superfícies limpas?', field_type: 'boolean', is_required: true, sort_order: 1 },
                { template_id: higieneTemplate.id, name: 'Geladeira organizada?', field_type: 'boolean', is_required: true, sort_order: 2 },
                { template_id: higieneTemplate.id, name: 'Temperatura geladeira', field_type: 'number', is_required: true, sort_order: 3 },
                { template_id: higieneTemplate.id, name: 'Foto do ambiente', field_type: 'photo', is_required: false, sort_order: 4 },
            ], { onConflict: 'template_id,name', ignoreDuplicates: true })
        }
        console.log('   ✅ Campos dos templates criados')

        // 7. Criar visibilidades (templates visíveis em todas as lojas)
        console.log('6. Configurando visibilidade dos templates...')
        const visibilityData = templates?.flatMap(template =>
            allStores?.map(store => ({
                template_id: template.id,
                store_id: store.id,
                roles: ['gerente', 'supervisor', 'operador'],
            })) || []
        ) || []

        if (visibilityData.length > 0) {
            const { error: visErr } = await supabase
                .from('template_visibility')
                .upsert(visibilityData, { onConflict: 'template_id,store_id', ignoreDuplicates: true })

            if (visErr && !visErr.message.includes('duplicate')) console.warn('   ⚠️ Erro ao criar visibilidades:', visErr.message)
            else console.log(`   ✅ ${visibilityData.length} visibilidades configuradas`)
        }

        console.log('\n🎉 Seed concluído com sucesso!')
        console.log(`   📦 ${allStores?.length || 0} lojas`)
        console.log(`   📂 ${sectorsData.length} setores`)
        console.log(`   📋 ${templates?.length || 0} templates`)

    } catch (error) {
        console.error('❌ Erro no seed:', error)
        process.exit(1)
    }
}

seedDatabase()
