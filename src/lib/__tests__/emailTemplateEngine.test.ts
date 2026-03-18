import { describe, it, expect } from 'vitest'
import {
  replaceTemplatePlaceholders,
  buildEmailFromTemplate,
  getSampleVariables,
  SEVERITY_COLORS,
  type EmailTemplateVariables,
} from '@/lib/emailTemplateEngine'

// ---------------------------------------------------------------------------
// Helper: minimal variables object with all required keys set to empty strings
// ---------------------------------------------------------------------------
function makeVariables(overrides: Partial<EmailTemplateVariables> = {}): EmailTemplateVariables {
  return {
    plan_title: '',
    field_name: '',
    store_name: '',
    sector_name: '',
    template_name: '',
    respondent_name: '',
    respondent_time: '',
    assignee_name: '',
    severity: '',
    severity_label: '',
    severity_color: '',
    deadline: '',
    non_conformity_value: '',
    description: '',
    plan_url: '',
    plan_id: '',
    is_reincidencia: '',
    reincidencia_count: '',
    reincidencia_prefix: '',
    app_name: '',
    ...overrides,
  }
}

// ============================================================================
// replaceTemplatePlaceholders
// ============================================================================

describe('replaceTemplatePlaceholders', () => {
  it('replaces a simple variable', () => {
    const vars = makeVariables({ store_name: 'Loja Centro' })
    const result = replaceTemplatePlaceholders('Loja: {{store_name}}', vars)
    expect(result).toBe('Loja: Loja Centro')
  })

  it('replaces multiple different variables in the same template', () => {
    const vars = makeVariables({
      store_name: 'Loja Centro',
      assignee_name: 'Maria',
    })
    const result = replaceTemplatePlaceholders(
      '{{store_name}} - {{assignee_name}}',
      vars,
    )
    expect(result).toBe('Loja Centro - Maria')
  })

  it('replaces the same variable appearing multiple times', () => {
    const vars = makeVariables({ severity_label: 'Alta' })
    const result = replaceTemplatePlaceholders(
      '{{severity_label}} / {{severity_label}}',
      vars,
    )
    expect(result).toBe('Alta / Alta')
  })

  it('leaves template unchanged when variable is not present in template', () => {
    const vars = makeVariables({ store_name: 'Loja Centro' })
    const template = 'Sem placeholders aqui'
    expect(replaceTemplatePlaceholders(template, vars)).toBe(template)
  })

  it('escapes HTML characters in regular variable values', () => {
    const vars = makeVariables({
      description: '<script>alert("xss")</script> & more',
    })
    const result = replaceTemplatePlaceholders('{{description}}', vars)
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; more')
  })

  it('escapes & character', () => {
    const vars = makeVariables({ field_name: 'A & B' })
    const result = replaceTemplatePlaceholders('{{field_name}}', vars)
    expect(result).toContain('&amp;')
  })

  it('escapes < character', () => {
    const vars = makeVariables({ field_name: '1 < 2' })
    const result = replaceTemplatePlaceholders('{{field_name}}', vars)
    expect(result).toContain('&lt;')
  })

  it('escapes > character', () => {
    const vars = makeVariables({ field_name: '2 > 1' })
    const result = replaceTemplatePlaceholders('{{field_name}}', vars)
    expect(result).toContain('&gt;')
  })

  it('escapes " character', () => {
    const vars = makeVariables({ field_name: 'say "hello"' })
    const result = replaceTemplatePlaceholders('{{field_name}}', vars)
    expect(result).toContain('&quot;')
  })

  it('does NOT escape severity_color (RAW_VARIABLE)', () => {
    const vars = makeVariables({ severity_color: '#f97316' })
    const result = replaceTemplatePlaceholders('color: {{severity_color}}', vars)
    expect(result).toBe('color: #f97316')
  })

  it('does NOT escape plan_url (RAW_VARIABLE)', () => {
    const vars = makeVariables({
      plan_url: 'https://app.operecheck.com/admin/planos?id=42&view=detail',
    })
    const result = replaceTemplatePlaceholders('<a href="{{plan_url}}">', vars)
    expect(result).toBe('<a href="https://app.operecheck.com/admin/planos?id=42&view=detail">')
  })

  it('does NOT escape reincidencia_prefix (RAW_VARIABLE)', () => {
    const vars = makeVariables({
      reincidencia_prefix: '<b>REINCIDENCIA</b> - ',
    })
    const result = replaceTemplatePlaceholders('{{reincidencia_prefix}}Plano', vars)
    expect(result).toBe('<b>REINCIDENCIA</b> - Plano')
  })

  it('handles empty string value', () => {
    const vars = makeVariables({ sector_name: '' })
    const result = replaceTemplatePlaceholders('Setor: {{sector_name}}!', vars)
    expect(result).toBe('Setor: !')
  })

  it('returns template unchanged when there are no placeholders', () => {
    const vars = makeVariables({ store_name: 'Loja Centro' })
    const template = '<p>Texto puro sem placeholders</p>'
    expect(replaceTemplatePlaceholders(template, vars)).toBe(template)
  })
})

// ============================================================================
// buildEmailFromTemplate
// ============================================================================

describe('buildEmailFromTemplate', () => {
  const vars = makeVariables({
    field_name: 'Higienizar maos',
    store_name: 'Loja Centro',
    reincidencia_prefix: '',
  })

  it('uses provided templateHtml and subjectTemplate', () => {
    const html = '<p>{{field_name}}</p>'
    const subject = 'Acao: {{field_name}}'
    const result = buildEmailFromTemplate(html, subject, vars)
    expect(result.html).toBe('<p>Higienizar maos</p>')
    expect(result.subject).toBe('Acao: Higienizar maos')
  })

  it('falls back to DEFAULT_ACTION_PLAN_EMAIL_HTML when templateHtml is null', () => {
    const result = buildEmailFromTemplate(null, 'Subject: {{field_name}}', vars)
    // The default HTML template should be used (contains the overall structure)
    expect(result.html).toContain('Plano de Acao')
    expect(result.html).toContain('Higienizar maos')
    // Subject should use provided template
    expect(result.subject).toBe('Subject: Higienizar maos')
  })

  it('falls back to DEFAULT_ACTION_PLAN_EMAIL_SUBJECT when subjectTemplate is null', () => {
    const result = buildEmailFromTemplate('<div>{{store_name}}</div>', null, vars)
    expect(result.html).toBe('<div>Loja Centro</div>')
    // Subject should use the default template pattern
    expect(result.subject).toContain('[OpereCheck]')
    expect(result.subject).toContain('Higienizar maos')
  })

  it('uses both defaults when templateHtml and subjectTemplate are null', () => {
    const result = buildEmailFromTemplate(null, null, vars)
    // HTML should come from default
    expect(result.html).toContain('<!DOCTYPE html>')
    expect(result.html).toContain('Higienizar maos')
    // Subject should come from default
    expect(result.subject).toContain('[OpereCheck]')
    expect(result.subject).toContain('Plano de Acao')
  })

  it('substitutes variables in both html and subject', () => {
    const customVars = makeVariables({
      field_name: 'Verificar temperatura',
      assignee_name: 'Carlos',
      reincidencia_prefix: 'REINCIDENCIA - ',
    })
    const result = buildEmailFromTemplate(
      '<p>{{field_name}} - {{assignee_name}}</p>',
      '{{reincidencia_prefix}}{{field_name}}',
      customVars,
    )
    expect(result.html).toBe('<p>Verificar temperatura - Carlos</p>')
    expect(result.subject).toBe('REINCIDENCIA - Verificar temperatura')
  })
})

// ============================================================================
// SEVERITY_COLORS
// ============================================================================

describe('SEVERITY_COLORS', () => {
  it('has an entry for baixa', () => {
    expect(SEVERITY_COLORS).toHaveProperty('baixa')
  })

  it('has an entry for media', () => {
    expect(SEVERITY_COLORS).toHaveProperty('media')
  })

  it('has an entry for alta', () => {
    expect(SEVERITY_COLORS).toHaveProperty('alta')
  })

  it('has an entry for critica', () => {
    expect(SEVERITY_COLORS).toHaveProperty('critica')
  })

  it.each(['baixa', 'media', 'alta', 'critica'])('%s value is a hex color', (key) => {
    expect(SEVERITY_COLORS[key]).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

// ============================================================================
// getSampleVariables
// ============================================================================

describe('getSampleVariables', () => {
  it('returns an object with all required keys', () => {
    const sample = getSampleVariables()
    const expectedKeys: (keyof EmailTemplateVariables)[] = [
      'plan_title',
      'field_name',
      'store_name',
      'sector_name',
      'template_name',
      'respondent_name',
      'respondent_time',
      'assignee_name',
      'severity',
      'severity_label',
      'severity_color',
      'deadline',
      'non_conformity_value',
      'description',
      'plan_url',
      'plan_id',
      'is_reincidencia',
      'reincidencia_count',
      'reincidencia_prefix',
      'app_name',
    ]
    for (const key of expectedKeys) {
      expect(sample).toHaveProperty(key)
    }
  })

  it('has no undefined values', () => {
    const sample = getSampleVariables()
    for (const [key, value] of Object.entries(sample)) {
      expect(value, `expected ${key} to not be undefined`).not.toBeUndefined()
    }
  })

  it('all values are strings', () => {
    const sample = getSampleVariables()
    for (const [key, value] of Object.entries(sample)) {
      expect(typeof value, `expected ${key} to be a string`).toBe('string')
    }
  })
})
