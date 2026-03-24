import type { Checklist } from '@/types/database'

/** Cria um checklist concluído com valores padrão sobrescrevíveis. */
export function createChecklist(overrides: Partial<Checklist> = {}): Checklist {
  return {
    id: 1,
    template_id: 1,
    store_id: 1,
    sector_id: null,
    created_by: 'user-123',
    validated_by: null,
    status: 'concluido',
    notes: null,
    started_at: '2026-01-01T08:00:00Z',
    created_at: '2026-01-01T08:00:00Z',
    completed_at: '2026-01-01T09:00:00Z',
    validated_at: null,
    ...overrides,
  } as Checklist
}

/** Cria uma resposta de checklist com valores padrão sobrescrevíveis. */
export function createChecklistResponse(overrides: Partial<{
  id: number
  checklist_id: number
  field_id: number
  value_text: string | null
  value_number: number | null
  value_json: unknown
  answered_by: string | null
  answered_at: string | null
}> = {}) {
  return {
    id: 1,
    checklist_id: 1,
    field_id: 1,
    value_text: 'Sim',
    value_number: null,
    value_json: null,
    answered_by: 'user-123',
    answered_at: '2026-01-01T08:30:00Z',
    ...overrides,
  }
}
