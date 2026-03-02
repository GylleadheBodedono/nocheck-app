/**
 * Queries para o Relatorio Fotografico de Nao-Conformidades.
 * Busca action_plans com fotos do problema e evidencias da resolucao.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type NCPhotoReportFilters = {
  dateFrom: string
  dateTo: string
  storeId?: number
  templateId?: number
  severity?: string
}

export type NCPhotoItem = {
  actionPlanId: number
  checklistId: number | null
  fieldName: string
  fieldType: string
  storeName: string
  templateName: string
  severity: string
  status: string
  nonConformityValue: string
  isReincidencia: boolean
  reincidenciaCount: number
  createdAt: string
  assignedUserName: string
  photos: string[]
  conditionalPhotos: string[]
  evidencePhotos: string[]
}

export type NCPhotoSummary = {
  totalNC: number
  withPhotos: number
  totalPhotos: number
  totalEvidencePhotos: number
}

/**
 * Busca dados do relatorio fotografico NC
 */
export async function fetchNCPhotoReport(
  supabase: SupabaseClient,
  filters: NCPhotoReportFilters
): Promise<{ items: NCPhotoItem[]; summary: NCPhotoSummary }> {
  // 1. Query action_plans com joins
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('action_plans')
    .select(`
      id, checklist_id, field_id, response_id, store_id, template_id,
      status, severity, non_conformity_value,
      is_reincidencia, reincidencia_count, created_at, assigned_to,
      field:template_fields(name, field_type),
      store:stores(name),
      template:checklist_templates(name)
    `)
    .gte('created_at', filters.dateFrom)
    .lte('created_at', filters.dateTo)
    .order('created_at', { ascending: false })

  if (filters.storeId) {
    query = query.eq('store_id', filters.storeId)
  }
  if (filters.templateId) {
    query = query.eq('template_id', filters.templateId)
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity)
  }

  const { data: plans } = await query

  if (!plans || plans.length === 0) {
    return {
      items: [],
      summary: { totalNC: 0, withPhotos: 0, totalPhotos: 0, totalEvidencePhotos: 0 },
    }
  }

  // 2. Batch-fetch checklist_responses pelos response_ids
  const responseIds = [...new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plans.map((p: any) => p.response_id).filter(Boolean)
  )] as number[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responsesMap = new Map<number, { photos: string[]; conditionalPhotos: string[] }>()

  if (responseIds.length > 0) {
    // Supabase .in() supports up to 300 items, batch if needed
    const batches = chunkArray(responseIds, 200)
    for (const batch of batches) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: responses } = await (supabase as any)
        .from('checklist_responses')
        .select('id, value_json')
        .in('id', batch)

      if (responses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of responses as any[]) {
          const json = r.value_json as Record<string, unknown> | null
          if (!json) continue
          const photos = (json.photos as string[] || []).filter(isValidPhotoUrl)
          const condPhotos = (json.conditionalPhotos as string[] || []).filter(isValidPhotoUrl)
          if (photos.length > 0 || condPhotos.length > 0) {
            responsesMap.set(r.id, { photos, conditionalPhotos: condPhotos })
          }
        }
      }
    }
  }

  // 3. Batch-fetch action_plan_evidence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planIds = plans.map((p: any) => p.id) as number[]
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

  // 5. Montar array de NCPhotoItem[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: NCPhotoItem[] = plans.map((p: any) => {
    const resp = p.response_id ? responsesMap.get(p.response_id) : undefined
    const photos = resp?.photos || []
    const conditionalPhotos = resp?.conditionalPhotos || []
    const evidencePhotos = evidenceMap.get(p.id) || []

    return {
      actionPlanId: p.id,
      checklistId: p.checklist_id,
      fieldName: p.field?.name || `Campo #${p.field_id || 0}`,
      fieldType: p.field?.field_type || 'unknown',
      storeName: p.store?.name || `Loja #${p.store_id || 0}`,
      templateName: p.template?.name || `Template #${p.template_id || 0}`,
      severity: p.severity || 'media',
      status: p.status || 'pendente',
      nonConformityValue: p.non_conformity_value || '',
      isReincidencia: p.is_reincidencia || false,
      reincidenciaCount: p.reincidencia_count || 0,
      createdAt: p.created_at,
      assignedUserName: userNameMap.get(p.assigned_to) || 'Nao atribuido',
      photos,
      conditionalPhotos,
      evidencePhotos,
    }
  })

  // Summary
  const allNCPhotos = items.reduce((sum, i) => sum + i.photos.length + i.conditionalPhotos.length, 0)
  const allEvidencePhotos = items.reduce((sum, i) => sum + i.evidencePhotos.length, 0)
  const withPhotos = items.filter(i => i.photos.length > 0 || i.conditionalPhotos.length > 0 || i.evidencePhotos.length > 0).length

  return {
    items,
    summary: {
      totalNC: items.length,
      withPhotos,
      totalPhotos: allNCPhotos,
      totalEvidencePhotos: allEvidencePhotos,
    },
  }
}

/**
 * Agrupa itens por semana ISO
 */
export function groupByWeek(items: NCPhotoItem[]): Map<string, { label: string; items: NCPhotoItem[] }> {
  const groups = new Map<string, { label: string; items: NCPhotoItem[] }>()

  for (const item of items) {
    const date = new Date(item.createdAt)
    const weekKey = getISOWeekKey(date)
    const existing = groups.get(weekKey)

    if (existing) {
      existing.items.push(item)
    } else {
      const { start, end } = getWeekRange(date)
      const weekNum = getISOWeekNumber(date)
      const label = `Semana ${weekNum} — ${formatDateBR(start)} a ${formatDateBR(end)}`
      groups.set(weekKey, { label, items: [item] })
    }
  }

  return groups
}

// === Helpers ===

function isValidPhotoUrl(url: string): boolean {
  return typeof url === 'string' && url.length > 0
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function getISOWeekKey(date: Date): string {
  const week = getISOWeekNumber(date)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date)
  const day = d.getDay() || 7
  const start = new Date(d)
  start.setDate(d.getDate() - day + 1) // Monday
  const end = new Date(start)
  end.setDate(start.getDate() + 6) // Sunday
  return { start, end }
}

function formatDateBR(date: Date): string {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}
