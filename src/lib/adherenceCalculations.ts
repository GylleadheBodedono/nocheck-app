/**
 * Funções puras de cálculo de adesão para relatórios.
 * Sem React, sem Supabase — recebe arrays de dados e retorna estruturas calculadas.
 *
 * Fluxo típico:
 * 1. `computeStatusBreakdown` → contagens por status
 * 2. `computeAdherenceMetrics` → taxas percentuais a partir das contagens
 * 3. `computeTemplateAdherence` / `computeStoreAdherence` / `computeUserAdherence` → cortes por dimensão
 * 4. `generateEnhancedAttentionPoints` → lista de alertas para o dashboard
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export type StatusBreakdown = {
  rascunho: number
  em_andamento: number
  concluido: number
  validado: number
  incompleto: number
  total: number
}

export type AdherenceMetrics = {
  completionRate: number
  inProgressRate: number
  abandonRate: number
  draftRate: number
  statusBreakdown: StatusBreakdown
}

export type TemplateAdherence = {
  templateId: number
  templateName: string
  metrics: AdherenceMetrics
  avgCompletionTimeMinutes: number | null
  storesWithZero: number
  totalAssignedStores: number
}

export type StoreAdherence = {
  storeId: number
  storeName: string
  metrics: AdherenceMetrics
  templatesNeverFilled: string[]
}

export type UserAdherence = {
  userId: string
  userName: string
  metrics: AdherenceMetrics
  avgCompletionTimeMinutes: number | null
}

export type CoverageGap = {
  templateName: string
  storeName: string
  templateId: number
  storeId: number
  lastFilledAt: string | null
  daysSinceLastFilled: number | null
}

export type DailyStatusStats = {
  date: string
  concluido: number
  validado: number
  em_andamento: number
  incompleto: number
  rascunho: number
  total: number
}

export type AttentionPoint = {
  text: string
  severity: 'warning' | 'error'
}

// Input types (minimal shapes from Supabase)
type ChecklistInput = {
  id: number
  store_id: number
  template_id: number
  sector_id: number | null
  status: string
  created_by: string
  started_at: string | null
  created_at: string
  completed_at: string | null
}

type SimpleEntity = { id: number; name: string }
type VisibilityRow = { template_id: number; store_id: number }
type UserLookup = { id: string; full_name: string }

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCOES DE CALCULO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Conta checklists por status e retorna o resumo com o total geral.
 *
 * @param checklists - Array de objetos com campo `status`
 * @returns `StatusBreakdown` com contagens por status e total
 */
export function computeStatusBreakdown(checklists: { status: string }[]): StatusBreakdown {
  const b: StatusBreakdown = { rascunho: 0, em_andamento: 0, concluido: 0, validado: 0, incompleto: 0, total: 0 }
  for (const c of checklists) {
    b.total++
    if (c.status === 'rascunho') b.rascunho++
    else if (c.status === 'em_andamento') b.em_andamento++
    else if (c.status === 'concluido') b.concluido++
    else if (c.status === 'validado') b.validado++
    else if (c.status === 'incompleto') b.incompleto++
  }
  return b
}

/**
 * Calcula as taxas percentuais de adesão a partir de um `StatusBreakdown`.
 * Usa `total || 1` para evitar divisão por zero.
 *
 * @param breakdown - Contagens por status (saída de `computeStatusBreakdown`)
 * @returns `AdherenceMetrics` com taxas de conclusão, abandono, etc.
 */
export function computeAdherenceMetrics(breakdown: StatusBreakdown): AdherenceMetrics {
  const t = breakdown.total || 1
  return {
    completionRate: Math.round(((breakdown.concluido + breakdown.validado) / t) * 100),
    inProgressRate: Math.round((breakdown.em_andamento / t) * 100),
    abandonRate: Math.round((breakdown.incompleto / t) * 100),
    draftRate: Math.round((breakdown.rascunho / t) * 100),
    statusBreakdown: breakdown,
  }
}

/**
 * Atalho para calcular métricas de adesão diretamente de uma lista de checklists.
 * Equivalente a `computeAdherenceMetrics(computeStatusBreakdown(checklists))`.
 *
 * @param checklists - Array de objetos com campo `status`
 * @returns `AdherenceMetrics` calculadas
 */
export function computeOverallAdherence(checklists: { status: string }[]): AdherenceMetrics {
  return computeAdherenceMetrics(computeStatusBreakdown(checklists))
}

/**
 * Calcula o tempo médio de conclusão em minutos a partir de pares `started_at`/`completed_at`.
 * Ignora itens sem ambos os timestamps ou com diferença negativa.
 *
 * @param items - Array com timestamps de início e conclusão
 * @returns Média em minutos (arredondada) ou `null` se nenhum item for concluído
 */
function calcAvgCompletionMinutes(items: { started_at: string | null; completed_at: string | null }[]): number | null {
  const times: number[] = []
  for (const c of items) {
    if (c.started_at && c.completed_at) {
      const diff = new Date(c.completed_at).getTime() - new Date(c.started_at).getTime()
      if (diff > 0) times.push(diff / 60000)
    }
  }
  if (times.length === 0) return null
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
}

/**
 * Calcula o tempo médio de conclusão para uma lista de checklists.
 *
 * @param checklists - Checklists com `started_at` e `completed_at`
 * @returns Tempo médio em minutos ou `null`
 */
export function computeAvgCompletionTime(checklists: ChecklistInput[]): number | null {
  return calcAvgCompletionMinutes(checklists)
}

/**
 * Calcula métricas de adesão agrupadas por template.
 * Inclui tempo médio de conclusão e contagem de lojas sem nenhum preenchimento.
 * Resultado ordenado por `completionRate` crescente (templates problemáticos primeiro).
 *
 * @param checklists - Lista de checklists do período
 * @param templates  - Templates ativos (id + name)
 * @param visibility - Mapa de visibilidade template→loja
 * @returns Array de `TemplateAdherence` ordenado por adesão crescente
 */
export function computeTemplateAdherence(
  checklists: ChecklistInput[],
  templates: SimpleEntity[],
  visibility: VisibilityRow[],
): TemplateAdherence[] {
  return templates.map((t) => {
    const tChecklists = checklists.filter((c) => c.template_id === t.id)
    const metrics = computeOverallAdherence(tChecklists)
    const avgTime = calcAvgCompletionMinutes(tChecklists)

    // Stores assigned to this template via visibility
    const assignedStoreIds = new Set(visibility.filter((v) => v.template_id === t.id).map((v) => v.store_id))
    const totalAssigned = assignedStoreIds.size
    const storesWithChecklists = new Set(tChecklists.map((c) => c.store_id))
    const storesWithZero = totalAssigned > 0
      ? [...assignedStoreIds].filter((sid) => !storesWithChecklists.has(sid)).length
      : 0

    return {
      templateId: t.id,
      templateName: t.name,
      metrics,
      avgCompletionTimeMinutes: avgTime,
      storesWithZero,
      totalAssignedStores: totalAssigned,
    }
  }).sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
}

/**
 * Calcula métricas de adesão agrupadas por loja.
 * Inclui lista de templates visíveis que nunca foram preenchidos pela loja.
 * Resultado ordenado por `completionRate` crescente (lojas problemáticas primeiro).
 *
 * @param checklists - Lista de checklists do período
 * @param stores     - Lojas ativas (id + name)
 * @param templates  - Templates ativos (id + name)
 * @param visibility - Mapa de visibilidade template→loja
 * @returns Array de `StoreAdherence` ordenado por adesão crescente
 */
export function computeStoreAdherence(
  checklists: ChecklistInput[],
  stores: SimpleEntity[],
  templates: SimpleEntity[],
  visibility: VisibilityRow[],
): StoreAdherence[] {
  const templateMap = new Map(templates.map((t) => [t.id, t.name]))

  return stores.map((s) => {
    const sChecklists = checklists.filter((c) => c.store_id === s.id)
    const metrics = computeOverallAdherence(sChecklists)

    // Templates assigned to this store via visibility
    const assignedTemplateIds = new Set(visibility.filter((v) => v.store_id === s.id).map((v) => v.template_id))
    const templatesFilledIds = new Set(sChecklists.map((c) => c.template_id))
    const templatesNeverFilled = [...assignedTemplateIds]
      .filter((tid) => !templatesFilledIds.has(tid))
      .map((tid) => templateMap.get(tid) || `Template #${tid}`)

    return {
      storeId: s.id,
      storeName: s.name,
      metrics,
      templatesNeverFilled,
    }
  }).sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
}

/**
 * Calcula métricas de adesão agrupadas por usuário (quem criou o checklist).
 * Inclui tempo médio de conclusão por usuário.
 * Resultado ordenado por `completionRate` crescente.
 *
 * @param checklists - Lista de checklists do período
 * @param users      - Lookup de usuários (id + full_name)
 * @returns Array de `UserAdherence` ordenado por adesão crescente
 */
export function computeUserAdherence(
  checklists: ChecklistInput[],
  users: UserLookup[],
): UserAdherence[] {
  const userMap = new Map(users.map((u) => [u.id, u.full_name]))
  const grouped = new Map<string, ChecklistInput[]>()

  for (const c of checklists) {
    const arr = grouped.get(c.created_by) || []
    arr.push(c)
    grouped.set(c.created_by, arr)
  }

  return Array.from(grouped.entries()).map(([userId, userChecklists]) => ({
    userId,
    userName: userMap.get(userId) || 'Desconhecido',
    metrics: computeOverallAdherence(userChecklists),
    avgCompletionTimeMinutes: calcAvgCompletionMinutes(userChecklists),
  })).sort((a, b) => a.metrics.completionRate - b.metrics.completionRate)
}

/**
 * Identifica lacunas de cobertura: combinações template+loja visíveis que
 * não tiveram nenhum checklist preenchido no período analisado.
 *
 * Deduplica linhas de visibilidade e ignora templates/lojas fora dos arrays fornecidos.
 * Resultado ordenado alfabeticamente por template+loja.
 *
 * @param checklists - Lista de checklists do período
 * @param templates  - Templates ativos (id + name)
 * @param stores     - Lojas ativas (id + name)
 * @param visibility - Mapa de visibilidade template→loja
 * @returns Array de `CoverageGap` com as combinações sem cobertura
 */
export function computeCoverageGaps(
  checklists: ChecklistInput[],
  templates: SimpleEntity[],
  stores: SimpleEntity[],
  visibility: VisibilityRow[],
): CoverageGap[] {
  const templateMap = new Map(templates.map((t) => [t.id, t.name]))
  const storeMap = new Map(stores.map((s) => [s.id, s.name]))

  // Deduplicate visibility rows by unique template_id + store_id
  // and filter out rows referencing templates/stores not in the active lists
  const seen = new Set<string>()
  const uniqueVisibility: VisibilityRow[] = []
  for (const v of visibility) {
    const key = `${v.template_id}-${v.store_id}`
    if (seen.has(key)) continue
    if (!templateMap.has(v.template_id)) continue
    if (!storeMap.has(v.store_id)) continue
    seen.add(key)
    uniqueVisibility.push(v)
  }

  // Index: "templateId-storeId" -> latest created_at
  const latestMap = new Map<string, string>()
  for (const c of checklists) {
    const key = `${c.template_id}-${c.store_id}`
    const existing = latestMap.get(key)
    if (!existing || c.created_at > existing) {
      latestMap.set(key, c.created_at)
    }
  }

  const gaps: CoverageGap[] = []

  for (const v of uniqueVisibility) {
    const key = `${v.template_id}-${v.store_id}`
    const lastFilled = latestMap.get(key) || null

    // Only report if no checklist in period
    if (!lastFilled) {
      gaps.push({
        templateId: v.template_id,
        templateName: templateMap.get(v.template_id)!,
        storeId: v.store_id,
        storeName: storeMap.get(v.store_id)!,
        lastFilledAt: null,
        daysSinceLastFilled: null,
      })
    }
  }

  return gaps.sort((a, b) => {
    return (a.templateName + a.storeName).localeCompare(b.templateName + b.storeName)
  })
}

/**
 * Agrega contagens de status por dia para os últimos `chartDays` dias.
 * Cada dia inclui contagens de todos os status e o total.
 * Datas são formatadas como "DD/MM" para exibição em gráficos.
 *
 * @param checklists - Lista de checklists (filtrada por período externamente)
 * @param chartDays  - Número de dias no histórico (ex: 7, 30)
 * @returns Array de `DailyStatusStats` do dia mais antigo ao mais recente
 */
export function computeDailyStatusStats(
  checklists: ChecklistInput[],
  chartDays: number,
): DailyStatusStats[] {
  const result: DailyStatusStats[] = []

  for (let i = chartDays - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    date.setHours(0, 0, 0, 0)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    const dayChecklists = checklists.filter((c) => {
      const d = new Date(c.created_at)
      return d >= date && d < nextDate
    })

    const b = computeStatusBreakdown(dayChecklists)

    result.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      concluido: b.concluido,
      validado: b.validado,
      em_andamento: b.em_andamento,
      incompleto: b.incompleto,
      rascunho: b.rascunho,
      total: b.total,
    })
  }

  return result
}

/**
 * Gera a lista de pontos de atenção do dashboard com base nos dados calculados.
 *
 * Regras aplicadas:
 * - Lojas com adesão < 50% → severity `error`
 * - Lojas com adesão 50–79% → severity `warning`
 * - Lojas com ≥ 5 checklists em andamento não finalizados → `warning`
 * - Planos de ação vencidos → `error`
 * - Lacunas de cobertura (template+loja sem preenchimento) → `error`
 * - Templates nunca preenchidos no período → `warning`
 *
 * @param storeAdherence      - Métricas por loja
 * @param templateAdherence   - Métricas por template (não usadas atualmente, reservado)
 * @param coverageGaps        - Lacunas de cobertura detectadas
 * @param overduePlansCount   - Quantidade de planos de ação vencidos
 * @param unusedTemplateNames - Nomes de templates sem preenchimento no período
 * @returns Array de `AttentionPoint` ordenado por prioridade de inserção
 */
export function generateEnhancedAttentionPoints(
  storeAdherence: StoreAdherence[],
  templateAdherence: TemplateAdherence[],
  coverageGaps: CoverageGap[],
  overduePlansCount: number,
  unusedTemplateNames: string[],
): AttentionPoint[] {
  const points: AttentionPoint[] = []

  // Stores with low completion
  for (const s of storeAdherence) {
    if (s.metrics.statusBreakdown.total === 0) continue
    if (s.metrics.completionRate < 50) {
      points.push({
        text: `Loja "${s.storeName}" com adesao critica: ${s.metrics.completionRate}% (${s.metrics.statusBreakdown.em_andamento} em andamento, ${s.metrics.statusBreakdown.incompleto} incompletos)`,
        severity: 'error',
      })
    } else if (s.metrics.completionRate < 80) {
      points.push({
        text: `Loja "${s.storeName}" com adesao abaixo do ideal: ${s.metrics.completionRate}%`,
        severity: 'warning',
      })
    }
  }

  // Stores with many in-progress not finalized
  for (const s of storeAdherence) {
    if (s.metrics.statusBreakdown.em_andamento >= 5) {
      points.push({
        text: `Loja "${s.storeName}": ${s.metrics.statusBreakdown.em_andamento} checklists em andamento nao finalizados`,
        severity: 'warning',
      })
    }
  }

  // Overdue action plans
  if (overduePlansCount > 0) {
    points.push({
      text: `${overduePlansCount} plano(s) de acao vencido(s)`,
      severity: 'error',
    })
  }

  // Coverage gaps summary
  if (coverageGaps.length > 0) {
    // Group gaps by template
    const byTemplate = new Map<string, string[]>()
    for (const g of coverageGaps) {
      const arr = byTemplate.get(g.templateName) || []
      arr.push(g.storeName)
      byTemplate.set(g.templateName, arr)
    }
    for (const [tName, stores] of byTemplate) {
      if (stores.length <= 3) {
        points.push({
          text: `"${tName}" deveria ser preenchido mas nao foi nas lojas: ${stores.join(', ')}`,
          severity: 'error',
        })
      } else {
        points.push({
          text: `"${tName}" deveria ser preenchido mas nao foi em ${stores.length} lojas`,
          severity: 'error',
        })
      }
    }
  }

  // Unused templates (not assigned via visibility but still never used)
  for (const name of unusedTemplateNames) {
    points.push({
      text: `Checklist "${name}" nao preenchido no periodo`,
      severity: 'warning',
    })
  }

  return points
}

/**
 * Formata uma duração em minutos para exibição legível (ex: `90` → `"1h 30min"`).
 *
 * @param minutes - Duração em minutos ou `null`
 * @returns String formatada: `"--"` se null, `"Xmin"` se < 60, `"Xh Ymin"` ou `"Xh"` se ≥ 60
 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--'
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
