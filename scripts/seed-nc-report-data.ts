/**
 * Seed de dados fictícios para testar o Relatório Fotográfico de Não-Conformidades.
 *
 * Cria checklists concluídos com respostas "Não" em campos yes_no e fotos placeholder (Picsum),
 * além de planos de ação ligados a essas respostas — para popular a tela Admin > Relatórios > Fotos NC.
 *
 * Uso:
 *   1. Configure .env ou .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   2. Rode: bun run seed:nc   ou   npx tsx scripts/seed-nc-report-data.ts
 *   3. Opcional: SEED_NC_COUNT=50 (default 30) para quantidade de checklists/NCs
 *
 * Requisitos: ao menos 1 loja ativa, 1 template com campo yes_no e 1 usuário (public.users + auth).
 */

// Carregar .env.local se existir (convenção Next.js)
async function loadEnvLocal() {
  try {
    const { readFileSync } = await import('fs')
    const path = await import('path')
    const envPath = path.join(process.cwd(), '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim()
        let val = trimmed.slice(idx + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1)
        process.env[key] = val
      }
    }
  } catch {
    // .env.local não existe ou não legível; usar só process.env
  }
}

function photoUrl(seed: string | number): string {
  return `https://picsum.photos/800/600?random=${seed}`
}

async function main() {
  await loadEnvLocal()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const count = Math.min(Number(process.env.SEED_NC_COUNT) || 30, 200)

  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env ou .env.local'
    )
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceKey)

  console.log('[Seed NC] Buscando lojas, templates (com campo yes_no) e usuários...')

  const [storesRes, templatesRes, usersRes] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase
      .from('checklist_templates')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
    supabase.from('users').select('id, full_name').eq('is_active', true).limit(10),
  ])

  const stores = storesRes.data || []
  const templates = templatesRes.data || []
  const users = usersRes.data || []

  if (stores.length === 0) {
    console.error('[Seed NC] Nenhuma loja ativa. Crie ao menos uma loja no admin.')
    process.exit(1)
  }
  if (templates.length === 0) {
    console.error('[Seed NC] Nenhum template ativo. Crie um template no admin.')
    process.exit(1)
  }
  if (users.length === 0) {
    console.error('[Seed NC] Nenhum usuário ativo em public.users. Crie um usuário e faça login uma vez.')
    process.exit(1)
  }

  const userId = users[0].id

  // Para cada template, buscar campos do tipo yes_no
  const templateFields = new Map<number, { id: number; name: string }[]>()
  for (const t of templates) {
    const { data: fields } = await supabase
      .from('template_fields')
      .select('id, name, field_type')
      .eq('template_id', t.id)
      .order('sort_order', { ascending: true })
    const yesNoFields = (fields || []).filter(
      (f: { field_type: string }) => f.field_type === 'yes_no'
    )
    if (yesNoFields.length > 0) templateFields.set(t.id, yesNoFields)
  }

  const templatesWithYesNo = templates.filter(t => templateFields.has(t.id))
  if (templatesWithYesNo.length === 0) {
    console.error(
      '[Seed NC] Nenhum template tem campo yes_no. Adicione ao menos um campo Sim/Não em um template.'
    )
    process.exit(1)
  }

  const severities = ['baixa', 'media', 'alta', 'critica'] as const
  const statuses = ['aberto', 'em_andamento', 'concluido'] as const

  let created = 0
  const now = new Date()
  const daysBack = 30

  for (let i = 0; i < count; i++) {
    const template = templatesWithYesNo[i % templatesWithYesNo.length]
    const store = stores[i % stores.length]
    const fields = templateFields.get(template.id)!
    const yesNoField = fields[i % fields.length]
    const severity = severities[i % severities.length]
    const status = statuses[i % 3]
    const date = new Date(now)
    date.setDate(date.getDate() - Math.floor(Math.random() * daysBack))
    date.setHours(8 + (i % 8), i % 60, 0, 0)
    const completedAt = date.toISOString()
    const deadline = new Date(date)
    deadline.setDate(deadline.getDate() + 7)

    const { data: checklistRow, error: checklistError } = await supabase
      .from('checklists')
      .insert({
        template_id: template.id,
        store_id: store.id,
        sector_id: null,
        status: 'concluido',
        created_by: userId,
        started_at: date.toISOString(),
        completed_at: completedAt,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      })
      .select('id')
      .single()

    if (checklistError) {
      console.warn('[Seed NC] Erro ao criar checklist:', checklistError.message)
      continue
    }

    const checklistId = checklistRow.id
    const numPhotos = 1 + (i % 3)
    const photos = Array.from({ length: numPhotos }, (_, j) =>
      photoUrl(`${checklistId}-${yesNoField.id}-${j}`)
    )
    const valueJson = {
      answer: 'nao',
      photos,
      conditionalText: `Não-conformidade de teste #${i + 1} — ${yesNoField.name}`,
      conditionalPhotos: [photoUrl(`${checklistId}-cond-${i}`)],
    }

    const { data: responseRow, error: responseError } = await supabase
      .from('checklist_responses')
      .insert({
        checklist_id: checklistId,
        field_id: yesNoField.id,
        value_text: 'nao',
        value_json: valueJson,
        answered_by: userId,
        answered_at: completedAt,
      })
      .select('id')
      .single()

    if (responseError) {
      console.warn('[Seed NC] Erro ao criar resposta:', responseError.message)
      continue
    }

    const { data: planRow, error: planError } = await supabase
      .from('action_plans')
      .insert({
        checklist_id: checklistId,
        field_id: yesNoField.id,
        response_id: responseRow.id,
        template_id: template.id,
        store_id: store.id,
        sector_id: null,
        title: `NC: ${yesNoField.name}`,
        description: `Plano de ação gerado por seed para teste — checklist #${checklistId}`,
        severity,
        status,
        assigned_to: userId,
        assigned_by: userId,
        deadline: deadline.toISOString().slice(0, 10),
        non_conformity_value: valueJson.conditionalText,
        is_reincidencia: i % 5 === 2,
        reincidencia_count: i % 5 === 2 ? 1 + (i % 3) : 0,
        created_by: userId,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      })
      .select('id')
      .single()

    if (planError) {
      console.warn('[Seed NC] Erro ao criar plano de ação:', planError.message)
      continue
    }

    // Em ~1/3 dos planos, adicionar foto de evidência (para testar contagem no relatório)
    if (planRow && i % 3 === 0) {
      await supabase.from('action_plan_evidence').insert({
        action_plan_id: planRow.id,
        file_name: `evidencia-${planRow.id}.jpg`,
        storage_path: `seed/evidencia-${planRow.id}.jpg`,
        storage_url: photoUrl(`ev-${planRow.id}`),
        uploaded_by: userId,
      })
    }

    created++
    if (created % 10 === 0) console.log(`[Seed NC] ${created}/${count}...`)
  }

  console.log(`[Seed NC] Concluído. ${created} não-conformidades com fotos fictícias criadas.`)
  console.log(
    '[Seed NC] Acesse Admin > Relatórios > Relatório Fotográfico NC e use "Últimos 30 dias" para ver os dados.'
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
