/**
 * Queries de analytics para conformidade e reincidencias.
 * Alimentam as tabs de relatorios (Fase 3).
 */

/**
 * Tipo generico do cliente Supabase.
 * Usamos um tipo estrutural minimo porque as queries usam selects
 * dinamicos com joins que o tipo estrito do Database nao suporta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = { from: (...args: any[]) => any; rpc: (...args: any[]) => any }

/** Registro de um action plan vindo do Supabase com joins */
interface ActionPlanRow {
  id: number
  field_id: number
  store_id: number
  template_id: number
  status: string
  severity: string
  is_reincidencia: boolean
  reincidencia_count: number
  deadline: string
  created_at: string
  completed_at: string | null
  assigned_to: string
  field: { name: string } | null
  store: { name: string } | null
  template: { name: string } | null
}

/** Registro simplificado de action plan para stats de responsavel */
interface ActionPlanBasicRow {
  id: number
  assigned_to: string
  status: string
  created_at: string
  completed_at: string | null
  deadline: string
}

/** Action plan enriquecido com dados do responsavel */
interface ActionPlanWithAssignee extends ActionPlanBasicRow {
  assignee: { full_name: string } | null
}

/** Resumo geral de conformidade no periodo */
export type ComplianceSummary = {
  totalNonConformities: number
  complianceRate: number
  plansCreated: number
  plansResolved: number
  plansOverdue: number
}

/** Linha de conformidade agrupada por campo de template */
export type FieldComplianceRow = {
  fieldId: number
  fieldName: string
  templateName: string
  totalPlans: number
  resolvedPlans: number
  complianceRate: number
}

/** Linha de conformidade agrupada por loja */
export type StoreComplianceRow = {
  storeId: number
  storeName: string
  totalPlans: number
  resolvedPlans: number
  overduePlans: number
  rate: number
}

/** Resumo de reincidencias no periodo */
export type ReincidenciaSummary = {
  totalReincidencias: number
  avgReincidenciaRate: number
  worstField: string | null
  worstStore: string | null
}

/** Linha de reincidencia agrupada por campo + loja */
export type ReincidenciaRow = {
  fieldId: number
  fieldName: string
  storeName: string
  templateName: string
  occurrences: number
  lastOccurrence: string
}

/** Celula do heatmap loja x campo */
export type HeatmapCell = {
  storeId: number
  storeName: string
  fieldName: string
  count: number
}

/** Estatisticas de planos de acao por responsavel */
export type AssigneeStats = {
  userId: string
  userName: string
  totalPlans: number
  completedPlans: number
  overduePlans: number
  avgResolutionDays: number | null
}

/**
 * Busca dados de conformidade para o periodo especificado.
 * Retorna resumo geral, agrupamento por campo e por loja.
 *
 * @param supabase - Cliente Supabase autenticado
 * @param days - Numero de dias para retroceder a partir de hoje
 * @returns Dados de conformidade com summary, byField e byStore
 */
export async function fetchComplianceData(
  supabase: SupabaseClient,
  days: number
): Promise<{
  summary: ComplianceSummary
  byField: FieldComplianceRow[]
  byStore: StoreComplianceRow[]
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString()

  // Buscar todos action_plans no periodo
  const { data: plans } = await supabase
    .from('action_plans')
    .select(`
      id, field_id, store_id, template_id, status, severity,
      is_reincidencia, reincidencia_count, deadline, created_at, completed_at,
      field:template_fields(name),
      store:stores(name),
      template:checklist_templates(name)
    `)
    .gte('created_at', cutoffISO)
    .order('created_at', { ascending: false })

  const typedPlans = (plans || []) as unknown as ActionPlanRow[]

  if (typedPlans.length === 0) {
    return {
      summary: { totalNonConformities: 0, complianceRate: 100, plansCreated: 0, plansResolved: 0, plansOverdue: 0 },
      byField: [],
      byStore: [],
    }
  }

  // Summary
  const resolved = typedPlans.filter((p) => p.status === 'concluido')
  const overdue = typedPlans.filter((p) => p.status === 'vencido')

  // Buscar total de checklists no periodo para calcular taxa
  const { count: totalChecklists } = await supabase
    .from('checklists')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', cutoffISO)

  const total = totalChecklists || 1
  const complianceRate = Math.round(((total - typedPlans.length) / total) * 100 * 10) / 10

  const summary: ComplianceSummary = {
    totalNonConformities: typedPlans.length,
    complianceRate: Math.max(0, complianceRate),
    plansCreated: typedPlans.length,
    plansResolved: resolved.length,
    plansOverdue: overdue.length,
  }

  // Agrupar por campo
  const fieldMap = new Map<number, { fieldName: string; templateName: string; total: number; resolved: number }>()
  for (const p of typedPlans) {
    const key = p.field_id || 0
    const existing = fieldMap.get(key)
    if (existing) {
      existing.total++
      if (p.status === 'concluido') existing.resolved++
    } else {
      fieldMap.set(key, {
        fieldName: p.field?.name || `Campo #${key}`,
        templateName: p.template?.name || '',
        total: 1,
        resolved: p.status === 'concluido' ? 1 : 0,
      })
    }
  }

  const byField: FieldComplianceRow[] = Array.from(fieldMap.entries())
    .map(([fieldId, data]) => ({
      fieldId,
      fieldName: data.fieldName,
      templateName: data.templateName,
      totalPlans: data.total,
      resolvedPlans: data.resolved,
      complianceRate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalPlans - a.totalPlans)

  // Agrupar por loja
  const storeMap = new Map<number, { storeName: string; total: number; resolved: number; overdue: number }>()
  for (const p of typedPlans) {
    const key = p.store_id
    const existing = storeMap.get(key)
    if (existing) {
      existing.total++
      if (p.status === 'concluido') existing.resolved++
      if (p.status === 'vencido') existing.overdue++
    } else {
      storeMap.set(key, {
        storeName: p.store?.name || `Loja #${key}`,
        total: 1,
        resolved: p.status === 'concluido' ? 1 : 0,
        overdue: p.status === 'vencido' ? 1 : 0,
      })
    }
  }

  const byStore: StoreComplianceRow[] = Array.from(storeMap.entries())
    .map(([storeId, data]) => ({
      storeId,
      storeName: data.storeName,
      totalPlans: data.total,
      resolvedPlans: data.resolved,
      overduePlans: data.overdue,
      rate: data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalPlans - a.totalPlans)

  return { summary, byField, byStore }
}

/**
 * Busca dados de reincidencia no periodo especificado.
 * Retorna resumo, linhas agrupadas por campo+loja e stats por responsavel.
 *
 * @param supabase - Cliente Supabase autenticado
 * @param days - Numero de dias para retroceder a partir de hoje
 * @returns Dados de reincidencia com summary, rows e byAssignee
 */
export async function fetchReincidenciaData(
  supabase: SupabaseClient,
  days: number
): Promise<{
  summary: ReincidenciaSummary
  rows: ReincidenciaRow[]
  byAssignee: AssigneeStats[]
}> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffISO = cutoff.toISOString()

  // Buscar planos com reincidencia (sem FK-disambiguated join que falha com 400)
  const { data: reincPlansRaw } = await supabase
    .from('action_plans')
    .select(`
      id, field_id, store_id, template_id, reincidencia_count,
      created_at, status, assigned_to, completed_at, deadline,
      field:template_fields(name),
      store:stores(name),
      template:checklist_templates(name)
    `)
    .eq('is_reincidencia', true)
    .gte('created_at', cutoffISO)
    .order('reincidencia_count', { ascending: false })

  // Buscar todos planos para stats de assignee
  const { data: allPlansRaw } = await supabase
    .from('action_plans')
    .select(`
      id, assigned_to, status, created_at, completed_at, deadline
    `)
    .gte('created_at', cutoffISO)

  const typedReincRaw = (reincPlansRaw || []) as unknown as ActionPlanRow[]
  const typedAllRaw = (allPlansRaw || []) as unknown as ActionPlanBasicRow[]

  // Buscar nomes dos responsaveis separadamente (evita FK-disambiguated join)
  const allAssigneeIds = [...new Set([
    ...typedReincRaw.map((p) => p.assigned_to),
    ...typedAllRaw.map((p) => p.assigned_to),
  ].filter(Boolean))]

  let assigneeNamesMap = new Map<string, string>()
  if (allAssigneeIds.length > 0) {
    const { data: assigneeUsers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', allAssigneeIds)

    const typedUsers = (assigneeUsers || []) as unknown as Array<{ id: string; full_name: string }>
    if (typedUsers.length > 0) {
      assigneeNamesMap = new Map(typedUsers.map((u) => [u.id, u.full_name]))
    }
  }

  // Enriquecer planos com dados do assignee
  const reincPlans = typedReincRaw.map((p) => ({
    ...p,
    assignee: assigneeNamesMap.get(p.assigned_to) ? { full_name: assigneeNamesMap.get(p.assigned_to)! } : null,
  }))
  const allPlans: ActionPlanWithAssignee[] = typedAllRaw.map((p) => ({
    ...p,
    assignee: assigneeNamesMap.get(p.assigned_to) ? { full_name: assigneeNamesMap.get(p.assigned_to)! } : null,
  }))

  if (reincPlans.length === 0) {
    // Gerar stats de responsavel mesmo sem reincidencias
    const byAssignee = buildAssigneeStats(allPlans)
    return {
      summary: { totalReincidencias: 0, avgReincidenciaRate: 0, worstField: null, worstStore: null },
      rows: [],
      byAssignee,
    }
  }

  // Agrupar reincidencias por campo+loja
  const groupKey = (p: { field_id: number; store_id: number }) => `${p.field_id}-${p.store_id}`
  const groupMap = new Map<string, ReincidenciaRow>()

  for (const p of reincPlans) {
    const key = groupKey(p)
    const existing = groupMap.get(key)
    if (existing) {
      existing.occurrences++
      if (new Date(p.created_at) > new Date(existing.lastOccurrence)) {
        existing.lastOccurrence = p.created_at
      }
    } else {
      groupMap.set(key, {
        fieldId: p.field_id,
        fieldName: p.field?.name || `Campo #${p.field_id}`,
        storeName: p.store?.name || `Loja #${p.store_id}`,
        templateName: p.template?.name || '',
        occurrences: 1,
        lastOccurrence: p.created_at,
      })
    }
  }

  const rows = Array.from(groupMap.values()).sort((a, b) => b.occurrences - a.occurrences)

  // Encontrar campo e loja com mais reincidencias
  const fieldCounts = new Map<string, number>()
  const storeCounts = new Map<string, number>()
  for (const p of reincPlans) {
    const fn = p.field?.name || ''
    const sn = p.store?.name || ''
    fieldCounts.set(fn, (fieldCounts.get(fn) || 0) + 1)
    storeCounts.set(sn, (storeCounts.get(sn) || 0) + 1)
  }

  let worstField: string | null = null
  let worstFieldCount = 0
  for (const [name, count] of fieldCounts) {
    if (count > worstFieldCount) { worstField = name; worstFieldCount = count }
  }

  let worstStore: string | null = null
  let worstStoreCount = 0
  for (const [name, count] of storeCounts) {
    if (count > worstStoreCount) { worstStore = name; worstStoreCount = count }
  }

  const summary: ReincidenciaSummary = {
    totalReincidencias: reincPlans.length,
    avgReincidenciaRate: rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.occurrences, 0) / rows.length * 10) / 10
      : 0,
    worstField,
    worstStore,
  }

  const byAssignee = buildAssigneeStats(allPlans)

  return { summary, rows, byAssignee }
}

/**
 * Calcula estatisticas de planos de acao por responsavel.
 * Agrupa por assigned_to e calcula totais, concluidos, vencidos e media de dias.
 *
 * @param plans - Lista de planos enriquecidos com dados do responsavel
 * @returns Array de stats por responsavel, ordenado por total de planos (desc)
 */
function buildAssigneeStats(plans: ActionPlanWithAssignee[]): AssigneeStats[] {
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const map = new Map<string, {
    userName: string
    total: number
    completed: number
    overdue: number
    resolutionDays: number[]
  }>()

  for (const p of plans) {
    const key = p.assigned_to
    const isCompleted = p.status === 'concluido'
    const isOverdue = p.status === 'vencido'
    const resDays = isCompleted && p.completed_at && p.created_at
      ? Math.round((new Date(p.completed_at).getTime() - new Date(p.created_at).getTime()) / MS_PER_DAY)
      : null

    const existing = map.get(key)
    if (existing) {
      existing.total++
      if (isCompleted) existing.completed++
      if (isOverdue) existing.overdue++
      if (resDays !== null) existing.resolutionDays.push(resDays)
    } else {
      map.set(key, {
        userName: p.assignee?.full_name || 'Desconhecido',
        total: 1,
        completed: isCompleted ? 1 : 0,
        overdue: isOverdue ? 1 : 0,
        resolutionDays: resDays !== null ? [resDays] : [],
      })
    }
  }

  return Array.from(map.entries())
    .map(([userId, data]) => ({
      userId,
      userName: data.userName,
      totalPlans: data.total,
      completedPlans: data.completed,
      overduePlans: data.overdue,
      avgResolutionDays: data.resolutionDays.length > 0
        ? Math.round(data.resolutionDays.reduce((a, b) => a + b, 0) / data.resolutionDays.length)
        : null,
    }))
    .sort((a, b) => b.totalPlans - a.totalPlans)
}

/**
 * Busca dados para o heatmap de nao-conformidades loja x campo.
 * Cada celula contem a contagem de planos de acao para a combinacao loja+campo.
 *
 * @param supabase - Cliente Supabase autenticado
 * @param days - Numero de dias para retroceder a partir de hoje
 * @returns Celulas do heatmap e listas de lojas/campos encontrados
 */
export async function fetchStoreHeatmap(
  supabase: SupabaseClient,
  days: number
): Promise<{ cells: HeatmapCell[]; stores: string[]; fields: string[] }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const { data: plans } = await supabase
    .from('action_plans')
    .select(`
      store_id, field_id,
      store:stores(name),
      field:template_fields(name)
    `)
    .gte('created_at', cutoff.toISOString())

  const typedPlans = (plans || []) as unknown as Array<{
    store_id: number
    field_id: number
    store: { name: string } | null
    field: { name: string } | null
  }>

  if (typedPlans.length === 0) {
    return { cells: [], stores: [], fields: [] }
  }

  const cellMap = new Map<string, HeatmapCell>()
  const storeSet = new Set<string>()
  const fieldSet = new Set<string>()

  for (const p of typedPlans) {
    const storeName = p.store?.name || `Loja #${p.store_id}`
    const fieldName = p.field?.name || `Campo #${p.field_id}`
    storeSet.add(storeName)
    fieldSet.add(fieldName)

    const key = `${storeName}|${fieldName}`
    const existing = cellMap.get(key)
    if (existing) {
      existing.count++
    } else {
      cellMap.set(key, { storeId: p.store_id, storeName, fieldName, count: 1 })
    }
  }

  return {
    cells: Array.from(cellMap.values()),
    stores: Array.from(storeSet).sort(),
    fields: Array.from(fieldSet).sort(),
  }
}

// ============================================
// QUERIES USANDO MATERIALIZED VIEWS
// Alternativas performaticas para dashboards
// ============================================

/** KPI diario retornado pela materialized view */
export type DailyKpi = {
  tenant_id: string
  store_id: number
  report_date: string
  total_checklists: number
  completed: number
  in_progress: number
  plans_created: number
  plans_resolved: number
}

/** Conformidade semanal retornada pela materialized view */
export type WeeklyCompliance = {
  tenant_id: string
  store_id: number
  template_id: number
  week: string
  total_responses: number
  non_conformities: number
  compliance_rate: number
}

/**
 * Busca KPIs diarios da materialized view via funcao RPC com filtro de tenant.
 * Retorna null se a view nao existir (tenant novo / view ainda nao criada).
 *
 * @param supabase - Cliente Supabase autenticado
 * @param tenantId - ID da organizacao (tenant)
 * @param from - Data de inicio do periodo
 * @param to - Data de fim do periodo
 * @returns Array de KPIs diarios ou null se a view nao existir
 */
export async function fetchDailyKpis(
  supabase: SupabaseClient,
  tenantId: string,
  from: Date,
  to: Date
): Promise<DailyKpi[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_daily_kpis', {
      p_tenant_id: tenantId,
      p_from: from.toISOString().split('T')[0],
      p_to: to.toISOString().split('T')[0],
    })

    if (error) {
      console.warn('[Analytics] get_daily_kpis error (view may not exist yet):', error.message)
      return null
    }

    return (data || []) as DailyKpi[]
  } catch {
    return null
  }
}

/**
 * Busca conformidade semanal da materialized view via funcao RPC.
 * Retorna null se a view nao existir (tenant novo / view ainda nao criada).
 *
 * @param supabase - Cliente Supabase autenticado
 * @param tenantId - ID da organizacao (tenant)
 * @param from - Data de inicio do periodo
 * @param to - Data de fim do periodo
 * @returns Array de conformidade semanal ou null se a view nao existir
 */
export async function fetchWeeklyCompliance(
  supabase: SupabaseClient,
  tenantId: string,
  from: Date,
  to: Date
): Promise<WeeklyCompliance[] | null> {
  try {
    const { data, error } = await supabase.rpc('get_compliance_summary', {
      p_tenant_id: tenantId,
      p_from: from.toISOString().split('T')[0],
      p_to: to.toISOString().split('T')[0],
    })

    if (error) {
      console.warn('[Analytics] get_compliance_summary error:', error.message)
      return null
    }

    return (data || []) as WeeklyCompliance[]
  } catch {
    return null
  }
}

/**
 * Agrega KPIs diarios em um resumo consolidado para o dashboard.
 * Soma todos os KPIs por dia e gera estatisticas diarias para graficos.
 *
 * @param kpis - Array de KPIs diarios (retornados por {@link fetchDailyKpis})
 * @returns Totais agregados e array de stats diarias para graficos
 */
export function aggregateDailyKpis(kpis: DailyKpi[]): {
  totalChecklists: number
  totalCompleted: number
  totalInProgress: number
  totalPlansCreated: number
  totalPlansResolved: number
  dailyStats: { date: string; count: number; completed: number }[]
} {
  const dailyMap = new Map<string, { count: number; completed: number }>()
  let totalChecklists = 0
  let totalCompleted = 0
  let totalInProgress = 0
  let totalPlansCreated = 0
  let totalPlansResolved = 0

  for (const kpi of kpis) {
    totalChecklists += kpi.total_checklists
    totalCompleted += kpi.completed
    totalInProgress += kpi.in_progress
    totalPlansCreated += kpi.plans_created
    totalPlansResolved += kpi.plans_resolved

    const existing = dailyMap.get(kpi.report_date)
    if (existing) {
      existing.count += kpi.total_checklists
      existing.completed += kpi.completed
    } else {
      dailyMap.set(kpi.report_date, {
        count: kpi.total_checklists,
        completed: kpi.completed,
      })
    }
  }

  const dailyStats = Array.from(dailyMap.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalChecklists,
    totalCompleted,
    totalInProgress,
    totalPlansCreated,
    totalPlansResolved,
    dailyStats,
  }
}
