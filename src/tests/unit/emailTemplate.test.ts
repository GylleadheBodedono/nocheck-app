/**
 * EMAIL TEMPLATE ENGINE — Unit Tests
 */

import { describe, it, expect } from 'vitest'
import { replaceTemplatePlaceholders as renderTemplate, getSampleVariables as getExampleVariables } from '@/lib/emailTemplateEngine'

describe('renderTemplate', () => {
  it('substitutes all variables', () => {
    const result = renderTemplate(
      'Hello {{field_name}}, severity: {{severity_label}}',
      { field_name: 'Limpeza', severity_label: 'Alta' }
    )
    expect(result).toBe('Hello Limpeza, severity: Alta')
  })

  it('escapes HTML in normal variables', () => {
    const result = renderTemplate(
      '<p>{{field_name}}</p>',
      { field_name: '<script>alert(1)</script>' }
    )
    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })

  it('does NOT escape RAW variables (severity_color, plan_url)', () => {
    const result = renderTemplate(
      '<div style="color:{{severity_color}}"><a href="{{plan_url}}">Link</a></div>',
      { severity_color: '#FF0000', plan_url: 'https://app.com/plan/1' }
    )
    expect(result).toContain('#FF0000')
    expect(result).toContain('https://app.com/plan/1')
  })

  it('replaces missing variables with empty string', () => {
    const result = renderTemplate('Hello {{nonexistent}}!', {})
    expect(result).toBe('Hello !')
  })
})

describe('getExampleVariables', () => {
  it('returns all expected fields', () => {
    const vars = getExampleVariables()
    expect(vars).toHaveProperty('field_name')
    expect(vars).toHaveProperty('severity_label')
    expect(vars).toHaveProperty('severity_color')
    expect(vars).toHaveProperty('store_name')
    expect(vars).toHaveProperty('plan_url')
    expect(vars).toHaveProperty('reincidencia_prefix')
  })
})
