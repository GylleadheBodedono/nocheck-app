/**
 * Queries para o Relatório de Planos de Ação.
 * Busca `action_plans` com filtros, evidências de conclusão e dados de contexto.
 *
 * Estratégia de fetching:
 * - Query principal em `action_plans` com joins de campo, loja, template e template_fields
 * - Batch-fetch de `action_plan_stores` (suporte a planos multi-loja)
 * - Batch-fetch de `action_plan_evidence` para fotos de resolução
 * - Batch-fetch de nomes de usuários (assignees)
 * - Filtro de loja client-side para suporte a multi-store via `action_plan_stores`
 */

/** Alias genérico para qualquer cliente Supabase (server ou browser). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

/** Filtros aplicáveis ao relatório de planos de ação. */
export type ActionPlanReportFilters = {
  dateFrom: string
  dateTo: string
  storeId?: number
  templateId?: number
  severity?: string
  status?: string
  assigneeId?: string
}

export type ActionPlanReportItem = {
  id: number
  title: string
  description: string | null
  severity: string
  status: string
  assignedTo: string
  assignedUserName: string
  deadline: string
  startedAt: string | null
  completedAt: string | null
  completionText: string | null
  isReincidencia: boolean
  reincidenciaCount: number
  nonConformityValue: string | null
  storeNames: string[]
  templateName: string
  fieldName: string
  createdAt: string
  evidencePhotos: string[]
}

export type ActionPlanReportSummary = {
  total: number
  concluidos: number
  vencidos: number
  emAndamento: number
}

/**
 * Busca os dados completos do relatório de planos de ação com filtros.
 * Aplica filtro de loja client-side para suportar planos multi-store.
 *
 * @param supabase - Cliente Supabase com acesso às tabelas necessárias
 * @param filters  - Filtros de data, loja, template, severidade, status e responsável
 * @returns `{ items, summary }` — itens detalhados e totalizadores (concluídos, vencidos, em andamento)
 */
export async function fetchActionPlanReport(
  supabase: SupabaseClient,
  filters: ActionPlanReportFilters
): Promise<{ items: ActionPlanReportItem[]; summary: ActionPlanReportSummary }> {
  // 1. Query action_plans com joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('action_plans')
    .select(`
      id, title, description, severity, status, assigned_to,
      deadline, started_at, completed_at, completion_text,
      is_reincidencia, reincidencia_count, non_conformity_value,
      store_id, template_id, field_id, created_at,
      field:template_fields(name),
      store:stores(name),
      template:checklist_templates(name)
    `)
    .gte('created_at', filters.dateFrom)
    .lte('created_at', filters.dateTo)
    .order('created_at', { ascending: false })

  if (filters.templateId) {
    query = query.eq('template_id', filters.templateId)
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.assigneeId) {
    query = query.eq('assigned_to', filters.assigneeId)
  }

  const { data: plans } = await query

  if (!plans || plans.length === 0) {
    return {
      items: [],
      summary: { total: 0, concluidos: 0, vencidos: 0, emAndamento: 0 },
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planIds = plans.map((p: any) => p.id) as number[]

  // 2. Batch-fetch action_plan_stores para multi-store
  const storesMap = new Map<number, string[]>()
  if (planIds.length > 0) {
    const batches = chunkArray(planIds, 200)
    for (const batch of batches) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: apStores } = await (supabase as any)
        .from('action_plan_stores')
        .select('action_plan_id, store:stores(name)')
        .in('action_plan_id', batch)

      if (apStores) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const aps of apStores as any[]) {
          const storeName = aps.store?.name
          if (!storeName) continue
          const existing = storesMap.get(aps.action_plan_id)
          if (existing) {
            if (!existing.includes(storeName)) existing.push(storeName)
          } else {
            storesMap.set(aps.action_plan_id, [storeName])
          }
        }
      }
    }
  }

  // 3. Batch-fetch action_plan_evidence
  const evidenceMap = new Map<number, string[]>()
  if (planIds.length > 0) {
    const batches = chunkArray(planIds, 200)
    for (const batch of batches) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: evidence } = await (supabase as any)
        .from('action_plan_evidence')
        .select('action_plan_id, storage_url')
        .in('action_plan_id', batch)

      if (evidence) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const e of evidence as any[]) {
          if (!e.storage_url) continue
          const existing = evidenceMap.get(e.action_plan_id)
          if (existing) {
            existing.push(e.storage_url)
          } else {
            evidenceMap.set(e.action_plan_id, [e.storage_url])
          }
        }
      }
    }
  }

  // 4. Batch-fetch user names
  const assigneeIds = [...new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plans.map((p: any) => p.assigned_to).filter(Boolean)
  )] as string[]

  const userNameMap = new Map<string, string>()
  if (assigneeIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: users } = await (supabase as any)
      .from('users')
      .select('id, full_name')
      .in('id', assigneeIds)

    if (users) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const u of users as any[]) {
        userNameMap.set(u.id, u.full_name || 'Sem nome')
      }
    }
  }

  // 5. Montar array de items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: ActionPlanReportItem[] = plans.map((p: any) => {
    const multiStoreNames = storesMap.get(p.id) || []
    const legacyStoreName = p.store?.name
    const storeNames = multiStoreNames.length > 0
      ? multiStoreNames
      : (legacyStoreName ? [legacyStoreName] : [`Loja #${p.store_id || 0}`])

    return {
      id: p.id,
      title: p.title || 'Sem titulo',
      description: p.description || null,
      severity: p.severity || 'media',
      status: p.status || 'aberto',
      assignedTo: p.assigned_to || '',
      assignedUserName: userNameMap.get(p.assigned_to) || 'Nao atribuido',
      deadline: p.deadline || '',
      startedAt: p.started_at || null,
      completedAt: p.completed_at || null,
      completionText: p.completion_text || null,
      isReincidencia: p.is_reincidencia || false,
      reincidenciaCount: p.reincidencia_count || 0,
      nonConformityValue: p.non_conformity_value || null,
      storeNames,
      templateName: p.template?.name || `Template #${p.template_id || 0}`,
      fieldName: p.field?.name || `Campo #${p.field_id || 0}`,
      createdAt: p.created_at,
      evidencePhotos: evidenceMap.get(p.id) || [],
    }
  })

  // 6. Filtro de loja client-side (multi-store)
  const items = filters.storeId
    ? allItems.filter(item => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const plan = plans.find((p: any) => p.id === item.id)
        if (plan?.store_id === filters.storeId) return true
        const multiStores = storesMap.get(item.id)
        if (multiStores) {
          // Check by querying store name match (storeId was not stored, but we can check)
          // Since we filter by name match, fetch the store name for the filter
          return true // will be filtered below
        }
        return false
      })
    : allItems

  // If storeId filter is active, re-filter to ensure correct matching
  let finalItems = items
  if (filters.storeId) {
    // We need the store name for the filter - fetch it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: filterStore } = await (supabase as any)
      .from('stores')
      .select('name')
      .eq('id', filters.storeId)
      .single()

    if (filterStore?.name) {
      const filterStoreName = filterStore.name
      finalItems = allItems.filter(item => item.storeNames.includes(filterStoreName))
    }
  }

  // 7. Summary
  const today = new Date().toISOString().split('T')[0]
  const concluidos = finalItems.filter(i => i.status === 'concluido').length
  const emAndamento = finalItems.filter(i => i.status === 'em_andamento').length
  const vencidos = finalItems.filter(i => {
    if (i.status === 'concluido' || i.status === 'cancelado') return false
    if (!i.deadline) return false
    return i.deadline < today
  }).length

  return {
    items: finalItems,
    summary: {
      total: finalItems.length,
      concluidos,
      vencidos,
      emAndamento,
    },
  }
}

// === Helpers internos ===

/**
 * Divide um array em blocos de tamanho `size`.
 * Usado para batch-fetch via `.in()` do Supabase (limite de ~200 IDs por query).
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
