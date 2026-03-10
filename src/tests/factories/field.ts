import type { FieldData, ResponseData } from '@/lib/actionPlanEngine'
import type { FieldCondition } from '@/types/database'

export function createField(overrides: Partial<FieldData> = {}): FieldData {
  return {
    id: 1,
    name: 'Campo Teste',
    field_type: 'yes_no',
    options: null,
    ...overrides,
  }
}

export function createResponse(overrides: Partial<ResponseData> = {}): ResponseData {
  return {
    field_id: 1,
    value_text: null,
    value_number: null,
    value_json: null,
    ...overrides,
  }
}

export function createCondition(overrides: Partial<FieldCondition> = {}): FieldCondition {
  return {
    id: 1,
    field_id: 1,
    condition_type: 'equals' as FieldCondition['condition_type'],
    condition_value: { value: 'Não' },
    severity: 'media' as FieldCondition['severity'],
    default_assignee_id: null,
    deadline_days: 7,
    description_template: null,
    is_active: true,
    require_photo_on_completion: true,
    require_text_on_completion: true,
    completion_max_chars: 800,
    created_at: new Date().toISOString(),
    ...overrides,
  } as FieldCondition
}
