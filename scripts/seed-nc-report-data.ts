/**
 * Seed completo de dados ficticios para popular TODAS as funcionalidades do NoCheck.
 *
 * Cria:
 * - Presets de planos de acao (modelos)
 * - Checklists com todos os status e respostas para todos os tipos de campo
 * - Action plans com todos os status, reincidencias, evidencias, historico
 * - Cross-validations com status variados
 * - Notificacoes para usuarios
 *
 * Uso:
 *   1. Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 *   2. npx tsx scripts/seed-nc-report-data.ts
 *   3. Opcional: SEED_COUNT=60 (default 50)
 */

async function loadEnvFiles() {
  const { readFileSync } = await import('fs')
  const path = await import('path')
  for (const name of ['.env', '.env.local']) {
    try {
      const envPath = path.join(process.cwd(), name)
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
          if (!process.env[key]) process.env[key] = val
        }
      }
    } catch { /* file not found */ }
  }
}

// ========================= HELPERS =========================

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, arr.length))
}
function rand(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }
function photoUrl(seed: string | number): string { return `https://picsum.photos/800/600?random=${seed}` }
function randomDate(daysBack: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack))
  d.setHours(rand(6, 20), rand(0, 59), 0, 0)
  return d
}
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

const SEVERITIES = ['baixa', 'media', 'alta', 'critica'] as const
const PLAN_STATUSES = ['aberto', 'em_andamento', 'concluido', 'vencido', 'cancelado'] as const
const CHECKLIST_STATUSES = ['concluido', 'concluido', 'concluido', 'em_andamento', 'rascunho', 'validado'] as const

const CONDITIONAL_TEXTS = [
  'Produto encontrado com validade vencida na prateleira. Lote removido imediatamente.',
  'Piso da area de producao com acumulo de agua proximo ao ralo. Risco de escorregamento.',
  'Extintor de incendio com carga vencida. Necessita recarga urgente.',
  'Equipamento de protecao individual (EPI) danificado. Luvas com furos visiveis.',
  'Temperatura da camara fria acima do limite permitido. Registrado 8°C (limite: 5°C).',
  'Etiqueta de identificacao ausente no recipiente de produto quimico.',
  'Colaborador sem uniforme completo durante manipulacao de alimentos.',
  'Lixeira sem tampa na area de preparo. Risco de contaminacao cruzada.',
  'Iluminacao insuficiente no deposito. Lampadas queimadas nao substituidas.',
  'Porta de acesso ao estoque sem fechadura funcionando. Seguranca comprometida.',
  'Rachaduras visiveis na parede da cozinha. Necessita reparo urgente.',
  'Produtos armazenados diretamente no chao, sem estrado ou pallet.',
  'Pia para higienizacao das maos sem sabonete liquido disponivel.',
  'Fiacao eletrica exposta proximo a area umida. Risco de choque eletrico.',
  'Janela sem tela de protecao contra insetos na area de manipulacao.',
  'Alimento descongelado em temperatura ambiente de forma inadequada.',
  'Documentacao de controle de pragas desatualizada ha mais de 3 meses.',
  'Balanca de precisao sem calibracao dentro do prazo de validade.',
  'Vazamento de agua visivel na tubulacao abaixo da pia.',
  'Funcionario sem treinamento registrado em boas praticas de fabricacao.',
  'Material de limpeza armazenado junto com alimentos no mesmo armario.',
  'Geladeira com borracha de vedacao danificada, nao fechando corretamente.',
  'Cardapio sem informacoes sobre alergenos conforme legislacao vigente.',
  'Ventilador direcionado para area de alimentos expostos.',
  'Lixo acumulado na area externa proximo a entrada de mercadorias.',
]

const COMPLETION_TEXTS = [
  'Problema corrigido. Equipe de manutencao realizou o reparo no mesmo dia.',
  'Item substituido e novo equipamento ja em uso. Documentacao atualizada.',
  'Treinamento realizado com toda a equipe sobre o procedimento correto.',
  'Limpeza profunda realizada e novo cronograma de higienizacao implementado.',
  'Fornecedor notificado e produto devolvido. Novo lote recebido e conferido.',
  'Manutencao preventiva agendada para evitar recorrencia do problema.',
  'Sinalizacao instalada e colaboradores orientados sobre o novo procedimento.',
  'Documentacao atualizada e disponibilizada em local visivel para consulta.',
  'Equipamento calibrado por empresa especializada. Certificado anexado.',
  'Reforma concluida na area afetada. Inspecao visual aprovada pelo supervisor.',
]

const COMMENT_TEXTS = [
  'Iniciando verificacao do problema relatado.',
  'Equipe de manutencao foi acionada para avaliar a situacao.',
  'Material necessario para reparo ja foi solicitado ao almoxarifado.',
  'Agendada visita tecnica para amanha as 14h.',
  'Reparo em andamento. Previsao de conclusao ate o final do dia.',
  'Supervisor informado sobre o progresso da acao corretiva.',
  'Documentacao fotografica do progresso anexada.',
  'Teste realizado apos reparo. Aguardando validacao final.',
  'Treinamento dos colaboradores envolvidos agendado para proxima semana.',
  'Solucao temporaria implementada enquanto aguardamos a peca definitiva.',
]

const TEXT_RESPONSES = [
  'Tudo em conformidade conforme verificado.',
  'Area limpa e organizada. Sem observacoes.',
  'Verificado e aprovado pelo supervisor.',
  'Equipamento funcionando corretamente.',
  'Nenhuma irregularidade encontrada na inspecao.',
  'Documentacao conferida e atualizada.',
  'Estoque conferido e dentro do padrao.',
  'Temperatura medida: dentro dos limites.',
]

// ========================= MAIN =========================

async function main() {
  await loadEnvFiles()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const count = Math.min(Number(process.env.SEED_COUNT) || 50, 200)

  if (!supabaseUrl || !serviceKey) {
    console.error('Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local')
    process.exit(1)
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, serviceKey)

  // ============ 1. FETCH EXISTING DATA ============
  console.log('[Seed] Buscando dados existentes...')

  const [storesRes, templatesRes, usersRes, sectorsRes] = await Promise.all([
    supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
    supabase.from('checklist_templates').select('id, name').eq('is_active', true).order('name'),
    supabase.from('users').select('id, full_name, is_admin').eq('is_active', true).limit(20),
    supabase.from('sectors').select('id, name, store_id').eq('is_active', true),
  ])

  const stores = storesRes.data || []
  const templates = templatesRes.data || []
  const users = usersRes.data || []
  const sectors = sectorsRes.data || []

  if (!stores.length) { console.error('[Seed] Nenhuma loja ativa.'); process.exit(1) }
  if (!templates.length) { console.error('[Seed] Nenhum template ativo.'); process.exit(1) }
  if (!users.length) { console.error('[Seed] Nenhum usuario ativo.'); process.exit(1) }

  console.log(`[Seed] ${stores.length} lojas, ${templates.length} templates, ${users.length} usuarios, ${sectors.length} setores`)

  // Fetch ALL fields per template
  type FieldInfo = { id: number; name: string; field_type: string; options: unknown; is_required: boolean }
  const templateFields = new Map<number, FieldInfo[]>()
  for (const t of templates) {
    const { data: fields } = await supabase
      .from('template_fields')
      .select('id, name, field_type, options, is_required')
      .eq('template_id', t.id)
      .order('sort_order')
    if (fields && fields.length > 0) templateFields.set(t.id, fields as FieldInfo[])
  }

  const validTemplates = templates.filter(t => templateFields.has(t.id))
  if (!validTemplates.length) { console.error('[Seed] Nenhum template com campos.'); process.exit(1) }

  const adminUsers = users.filter(u => u.is_admin)
  const allUserIds = users.map(u => u.id)

  // ============ 2. CREATE PRESETS ============
  console.log('[Seed] Criando presets de plano de acao...')

  const presetDefs = [
    { name: 'Temperatura fora do padrao', severity: 'critica', deadline_days: 3, description_template: 'NC Temperatura: {field_name} - {store_name}' },
    { name: 'Higiene inadequada', severity: 'alta', deadline_days: 7, description_template: 'NC Higiene: {field_name} - {store_name}' },
    { name: 'Equipamento danificado', severity: 'media', deadline_days: 14, description_template: 'NC Equipamento: {field_name} - {store_name}' },
    { name: 'Documentacao pendente', severity: 'baixa', deadline_days: 30, description_template: 'NC Documentacao: {field_name} - {store_name}' },
  ]

  const presetIds: number[] = []
  for (const p of presetDefs) {
    const { data: existing } = await supabase.from('action_plan_presets').select('id').eq('name', p.name).maybeSingle()
    if (existing) {
      presetIds.push(existing.id)
    } else {
      const { data: created } = await supabase.from('action_plan_presets').insert({
        ...p,
        is_active: true,
        require_photo_on_completion: true,
        require_text_on_completion: true,
        completion_max_chars: 800,
        default_assignee_id: adminUsers.length > 0 ? pick(adminUsers).id : users[0].id,
      }).select('id').single()
      if (created) presetIds.push(created.id)
    }
  }
  console.log(`[Seed] ${presetIds.length} presets prontos`)

  // ============ 3. CREATE CHECKLISTS + RESPONSES ============
  console.log(`[Seed] Criando ${count} checklists com respostas...`)

  const createdPlans: { id: number; fieldId: number; storeId: number; assigneeId: string; status: string }[] = []
  let checklistsCreated = 0
  let responsesCreated = 0
  let plansCreated = 0

  for (let i = 0; i < count; i++) {
    const template = pick(validTemplates)
    const store = pick(stores)
    const sector = sectors.find(s => s.store_id === store.id) || null
    const creator = pick(users)
    const fields = templateFields.get(template.id)!
    const status = pick(CHECKLIST_STATUSES)
    const date = randomDate(90)
    const isCompleted = ['concluido', 'validado'].includes(status)

    const completedAt = isCompleted ? new Date(date.getTime() + rand(30, 120) * 60000).toISOString() : null
    const validatedBy = status === 'validado' && adminUsers.length > 0 ? pick(adminUsers).id : null

    const { data: checklistRow, error: checklistErr } = await supabase
      .from('checklists')
      .insert({
        template_id: template.id,
        store_id: store.id,
        sector_id: sector?.id || null,
        status,
        created_by: creator.id,
        started_at: date.toISOString(),
        completed_at: completedAt,
        validated_by: validatedBy,
        validated_at: validatedBy ? completedAt : null,
        created_at: date.toISOString(),
        updated_at: completedAt || date.toISOString(),
      })
      .select('id')
      .single()

    if (checklistErr) { console.warn(`  [!] Checklist #${i}: ${checklistErr.message}`); continue }
    checklistsCreated++
    const checklistId = checklistRow.id

    // Create responses for all fields (only for completed/validated/em_andamento checklists)
    if (['concluido', 'validado', 'em_andamento'].includes(status)) {
      for (const field of fields) {
        const { valueText, valueNumber, valueJson } = generateResponse(field, i, checklistId)

        const { error: respErr } = await supabase.from('checklist_responses').insert({
          checklist_id: checklistId,
          field_id: field.id,
          value_text: valueText,
          value_number: valueNumber,
          value_json: valueJson,
          answered_by: creator.id,
          answered_at: date.toISOString(),
        })

        if (!respErr) responsesCreated++

        // Create action plan for "nao" answers in yes_no fields
        if (field.field_type === 'yes_no' && isCompleted) {
          const answer = typeof valueJson === 'object' && valueJson !== null
            ? (valueJson as Record<string, unknown>).answer
            : valueText
          if (answer === 'nao') {
            const plan = await createActionPlan(
              supabase, checklistId, field, template, store, sector,
              creator, users, date, i, createdPlans
            )
            if (plan) {
              createdPlans.push(plan)
              plansCreated++
            }
          }
        }
      }
    }

    if (checklistsCreated % 10 === 0) {
      console.log(`  [Seed] ${checklistsCreated}/${count} checklists, ${responsesCreated} respostas, ${plansCreated} plans...`)
    }
  }

  console.log(`[Seed] ${checklistsCreated} checklists, ${responsesCreated} respostas, ${plansCreated} plans criados`)

  // ============ 4. CREATE PLAN UPDATES + EVIDENCE ============
  console.log('[Seed] Criando historico e evidencias dos planos...')

  let updatesCreated = 0
  let evidenceCreated = 0

  for (const plan of createdPlans) {
    if (['em_andamento', 'concluido', 'vencido'].includes(plan.status)) {
      // Status change: aberto -> em_andamento
      await supabase.from('action_plan_updates').insert({
        action_plan_id: plan.id,
        user_id: plan.assigneeId,
        update_type: 'status_change',
        content: 'Plano iniciado',
        old_status: 'aberto',
        new_status: 'em_andamento',
        created_at: new Date(Date.now() - rand(5, 30) * 86400000).toISOString(),
      })
      updatesCreated++

      // Comment
      await supabase.from('action_plan_updates').insert({
        action_plan_id: plan.id,
        user_id: plan.assigneeId,
        update_type: 'comment',
        content: pick(COMMENT_TEXTS),
        created_at: new Date(Date.now() - rand(2, 15) * 86400000).toISOString(),
      })
      updatesCreated++
    }

    if (plan.status === 'concluido') {
      // Status change: em_andamento -> concluido
      await supabase.from('action_plan_updates').insert({
        action_plan_id: plan.id,
        user_id: plan.assigneeId,
        update_type: 'status_change',
        content: 'Plano concluido',
        old_status: 'em_andamento',
        new_status: 'concluido',
        created_at: new Date(Date.now() - rand(1, 5) * 86400000).toISOString(),
      })
      updatesCreated++

      // Evidence photos (1-3)
      const numEvidence = rand(1, 3)
      for (let e = 0; e < numEvidence; e++) {
        await supabase.from('action_plan_evidence').insert({
          action_plan_id: plan.id,
          file_name: `evidencia-${plan.id}-${e}.jpg`,
          file_type: 'image/jpeg',
          storage_path: `seed/evidencia-${plan.id}-${e}.jpg`,
          storage_url: photoUrl(`ev-${plan.id}-${e}`),
          uploaded_by: plan.assigneeId,
        })
        evidenceCreated++
      }
    }
  }
  console.log(`[Seed] ${updatesCreated} updates, ${evidenceCreated} evidencias`)

  // ============ 5. CREATE CROSS-VALIDATIONS ============
  console.log('[Seed] Criando cross-validations...')

  const cvStatuses = ['pendente', 'sucesso', 'falhou', 'notas_diferentes', 'expirado'] as const
  let cvsCreated = 0

  for (let i = 0; i < 12; i++) {
    const store = pick(stores)
    const sector = sectors.find(s => s.store_id === store.id) || null
    const status = cvStatuses[i % cvStatuses.length]
    const nota = `NF-${rand(10000, 99999)}`
    const valorEst = rand(100, 5000) + rand(0, 99) / 100
    const valorApr = status === 'sucesso' ? valorEst : valorEst + (rand(-200, 200) + rand(0, 99) / 100)
    const diff = Math.abs(valorEst - valorApr)
    const date = randomDate(60)

    if (status === 'notas_diferentes') {
      // Create paired validations
      const { data: cv1 } = await supabase.from('cross_validations').insert({
        store_id: store.id, sector_id: sector?.id || null, numero_nota: nota,
        valor_estoquista: valorEst, valor_aprendiz: null, diferenca: null,
        status, is_primary: true, match_reason: 'Notas diferentes encontradas',
        validated_at: date.toISOString(), created_at: date.toISOString(),
      }).select('id').single()

      if (cv1) {
        const { data: cv2 } = await supabase.from('cross_validations').insert({
          store_id: store.id, sector_id: sector?.id || null, numero_nota: `NF-${rand(10000, 99999)}`,
          valor_estoquista: null, valor_aprendiz: valorApr, diferenca: diff,
          status, is_primary: false, linked_validation_id: cv1.id,
          match_reason: 'Par da validacao #' + cv1.id,
          validated_at: date.toISOString(), created_at: date.toISOString(),
        }).select('id').single()

        if (cv2) {
          await supabase.from('cross_validations').update({ linked_validation_id: cv2.id }).eq('id', cv1.id)
          cvsCreated += 2
        }
      }
    } else {
      const { error } = await supabase.from('cross_validations').insert({
        store_id: store.id, sector_id: sector?.id || null, numero_nota: nota,
        valor_estoquista: valorEst, valor_aprendiz: status !== 'pendente' ? valorApr : null,
        diferenca: status !== 'pendente' ? diff : null,
        status, is_primary: true,
        validated_at: status !== 'pendente' ? date.toISOString() : null,
        created_at: date.toISOString(),
      })
      if (!error) cvsCreated++
    }
  }
  console.log(`[Seed] ${cvsCreated} cross-validations`)

  // ============ 6. CREATE NOTIFICATIONS ============
  console.log('[Seed] Criando notificacoes...')

  const notifTypes = [
    'action_plan_assigned', 'action_plan_overdue', 'action_plan_completed',
    'reincidencia_detected', 'action_plan_created', 'action_plan_comment',
  ]
  let notifsCreated = 0

  for (let i = 0; i < 20; i++) {
    const targetUser = pick(users)
    const notifType = pick(notifTypes)
    const relatedPlan = createdPlans.length > 0 ? pick(createdPlans) : null

    const { error } = await supabase.from('notifications').insert({
      user_id: targetUser.id,
      type: notifType,
      title: notifType === 'action_plan_assigned' ? 'Novo plano de acao atribuido'
        : notifType === 'action_plan_overdue' ? 'Plano de acao vencido'
        : notifType === 'action_plan_completed' ? 'Plano de acao concluido'
        : notifType === 'reincidencia_detected' ? 'Reincidencia detectada'
        : notifType === 'action_plan_created' ? 'Plano de acao gerado'
        : 'Novo comentario no plano',
      message: pick(CONDITIONAL_TEXTS).slice(0, 100) + '...',
      link: relatedPlan ? `/admin/planos-de-acao/${relatedPlan.id}` : '/admin/planos-de-acao',
      is_read: Math.random() > 0.4,
      metadata: relatedPlan ? { action_plan_id: relatedPlan.id } : {},
      created_at: randomDate(30).toISOString(),
    })
    if (!error) notifsCreated++
  }
  console.log(`[Seed] ${notifsCreated} notificacoes`)

  // ============ SUMMARY ============
  console.log('\n========================================')
  console.log('[Seed] CONCLUIDO!')
  console.log(`  Checklists:       ${checklistsCreated}`)
  console.log(`  Respostas:        ${responsesCreated}`)
  console.log(`  Planos de acao:   ${plansCreated}`)
  console.log(`  Updates/hist.:    ${updatesCreated}`)
  console.log(`  Evidencias:       ${evidenceCreated}`)
  console.log(`  Cross-valid.:     ${cvsCreated}`)
  console.log(`  Notificacoes:     ${notifsCreated}`)
  console.log(`  Presets:          ${presetIds.length}`)
  console.log('========================================')
  console.log('[Seed] Acesse o admin para verificar os dados em todas as paginas.')
}

// ========================= RESPONSE GENERATOR =========================

function generateResponse(
  field: { id: number; name: string; field_type: string; options: unknown },
  index: number,
  checklistId: number
): { valueText: string | null; valueNumber: number | null; valueJson: unknown } {
  switch (field.field_type) {
    case 'yes_no': {
      const isNao = Math.random() < 0.3 // 30% nao-conformidade
      const answer = isNao ? 'nao' : 'sim'
      if (isNao) {
        const text = pick(CONDITIONAL_TEXTS)
        return {
          valueText: 'nao',
          valueNumber: null,
          valueJson: {
            answer: 'nao',
            photos: [photoUrl(`${checklistId}-${field.id}-main`)],
            conditionalText: text,
            conditionalPhotos: [photoUrl(`${checklistId}-${field.id}-cond`)],
          },
        }
      }
      return { valueText: 'sim', valueNumber: null, valueJson: null }
    }

    case 'text':
      return { valueText: pick(TEXT_RESPONSES), valueNumber: null, valueJson: null }

    case 'number': {
      const opts = field.options as Record<string, unknown> | null
      const subtype = (opts?.numberSubtype as string) || 'decimal'
      const num = subtype === 'porcentagem' ? rand(0, 100) : subtype === 'monetario' ? rand(10, 500) + 0.99 : rand(1, 200)
      return { valueText: null, valueNumber: num, valueJson: { subtype, number: num } }
    }

    case 'photo':
      return {
        valueText: null,
        valueNumber: null,
        valueJson: [photoUrl(`${checklistId}-photo-${field.id}-0`), photoUrl(`${checklistId}-photo-${field.id}-1`)],
      }

    case 'dropdown': {
      const opts = Array.isArray(field.options) ? field.options : []
      const val = opts.length > 0 ? pick(opts) : 'Opcao A'
      return { valueText: val as string, valueNumber: null, valueJson: null }
    }

    case 'rating': {
      const rating = pick(['pessimo', 'ruim', 'regular', 'bom'])
      return { valueText: rating, valueNumber: null, valueJson: null }
    }

    case 'checkbox_multiple': {
      const opts = Array.isArray(field.options) ? field.options as string[] : ['Opcao 1', 'Opcao 2']
      const selected = pickN(opts, rand(1, Math.min(3, opts.length)))
      return { valueText: null, valueNumber: null, valueJson: selected }
    }

    case 'signature':
      return {
        valueText: null, valueNumber: null,
        valueJson: { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', timestamp: new Date().toISOString() },
      }

    case 'datetime':
      return { valueText: new Date(Date.now() - rand(0, 30) * 86400000).toISOString().slice(0, 16), valueNumber: null, valueJson: null }

    case 'gps':
      return {
        valueText: null, valueNumber: null,
        valueJson: { latitude: -23.55 + Math.random() * 0.1, longitude: -46.63 + Math.random() * 0.1, accuracy: rand(5, 50), timestamp: new Date().toISOString() },
      }

    case 'barcode':
      return { valueText: `789${rand(1000000000, 9999999999)}`, valueNumber: null, valueJson: null }

    case 'calculated':
      return { valueText: null, valueNumber: rand(10, 500) + 0.5, valueJson: null }

    default:
      return { valueText: `Valor seed #${index}`, valueNumber: null, valueJson: null }
  }
}

// ========================= ACTION PLAN CREATOR =========================

async function createActionPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  checklistId: number,
  field: { id: number; name: string },
  template: { id: number; name: string },
  store: { id: number; name: string },
  sector: { id: number; name: string } | null,
  creator: { id: string },
  users: { id: string; full_name: string }[],
  date: Date,
  index: number,
  existingPlans: { id: number; fieldId: number; storeId: number; assigneeId: string; status: string }[]
): Promise<{ id: number; fieldId: number; storeId: number; assigneeId: string; status: string } | null> {

  const status = weightedPick(
    ['aberto', 'em_andamento', 'concluido', 'vencido', 'cancelado'],
    [30, 25, 25, 15, 5]
  )
  const severity = pick([...SEVERITIES])
  const assignee = pick(users)

  // Check reincidencia
  const prevPlan = existingPlans.find(p => p.fieldId === field.id && p.storeId === store.id)
  const isReincidencia = !!prevPlan
  const reincidenciaCount = isReincidencia ? existingPlans.filter(p => p.fieldId === field.id && p.storeId === store.id).length : 0

  const deadline = new Date(date)
  if (status === 'vencido') {
    deadline.setDate(deadline.getDate() - rand(1, 10)) // past deadline
  } else {
    deadline.setDate(deadline.getDate() + rand(3, 30))
  }

  const completedAt = status === 'concluido'
    ? new Date(date.getTime() + rand(1, 14) * 86400000).toISOString()
    : null
  const completionText = status === 'concluido' ? pick(COMPLETION_TEXTS) : null

  // Get response id
  const { data: respRow } = await supabase.from('checklist_responses')
    .select('id').eq('checklist_id', checklistId).eq('field_id', field.id).single()

  const { data: planRow, error: planErr } = await supabase.from('action_plans').insert({
    checklist_id: checklistId,
    field_id: field.id,
    response_id: respRow?.id || null,
    template_id: template.id,
    store_id: store.id,
    sector_id: sector?.id || null,
    title: isReincidencia
      ? `REINCIDENCIA #${reincidenciaCount + 1}: ${field.name} - ${store.name}`
      : `NC: ${field.name} - ${store.name}`,
    description: pick(CONDITIONAL_TEXTS),
    severity,
    status,
    assigned_to: assignee.id,
    assigned_by: creator.id,
    deadline: deadline.toISOString().slice(0, 10),
    non_conformity_value: pick(CONDITIONAL_TEXTS),
    is_reincidencia: isReincidencia,
    reincidencia_count: reincidenciaCount,
    parent_action_plan_id: prevPlan?.id || null,
    require_photo_on_completion: true,
    require_text_on_completion: true,
    completion_max_chars: 800,
    completion_text: completionText,
    completed_at: completedAt,
    created_by: creator.id,
    created_at: date.toISOString(),
    updated_at: (completedAt || date.toISOString()),
  }).select('id').single()

  if (planErr) {
    console.warn(`  [!] Plan for field ${field.id}: ${planErr.message}`)
    return null
  }

  return {
    id: planRow.id,
    fieldId: field.id,
    storeId: store.id,
    assigneeId: assignee.id,
    status,
  }
}

main().catch(err => { console.error(err); process.exit(1) })
