import type { ChecklistTemplate, TemplateField } from '@/types/database'

/** Cria um template de checklist com valores padrão sobrescrevíveis. */
export function createTemplate(overrides: Partial<ChecklistTemplate> = {}): ChecklistTemplate {
  return {
    id: 1,
    name: 'Template Teste',
    description: null,
    category: 'outros',
    is_active: true,
    admin_only: false,
    allowed_start_time: null,
    allowed_end_time: null,
    created_by: 'admin-456',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ChecklistTemplate
}

/** Cria um campo de template com valores padrão sobrescrevíveis. */
export function createTemplateField(overrides: Partial<TemplateField> = {}): TemplateField {
  return {
    id: 1,
    template_id: 1,
    section_id: null,
    name: 'Campo Teste',
    field_type: 'yes_no',
    required: true,
    order_index: 0,
    options: null,
    placeholder: null,
    help_text: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as TemplateField
}
