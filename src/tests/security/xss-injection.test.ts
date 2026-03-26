/**
 * XSS & INJECTION TESTS
 * Verifica que inputs maliciosos sao sanitizados.
 */

import { describe, it, expect } from 'vitest'
import { replaceTemplatePlaceholders as renderTemplate } from '@/lib/emailTemplateEngine'

describe('Email Template XSS — reincidencia_prefix', () => {
  it('ESCAPES script tags in reincidencia_prefix (was RAW_VARIABLE)', () => {
    const result = renderTemplate(
      '<div>{{reincidencia_prefix}} Test</div>',
      { reincidencia_prefix: '<script>alert("xss")</script>' }
    )
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('does NOT escape severity_color (legitimate RAW variable)', () => {
    const result = renderTemplate(
      '<div style="background: {{severity_color}}">Test</div>',
      { severity_color: '#FF0000' }
    )
    expect(result).toContain('#FF0000')
    expect(result).not.toContain('&lt;')
  })

  it('does NOT escape plan_url (legitimate RAW variable)', () => {
    const result = renderTemplate(
      '<a href="{{plan_url}}">Link</a>',
      { plan_url: 'https://app.operecheck.com/plan/42' }
    )
    expect(result).toContain('https://app.operecheck.com/plan/42')
  })

  it('ESCAPES all other variables by default', () => {
    const result = renderTemplate(
      '<p>{{field_name}}</p>',
      { field_name: '<img src=x onerror=alert(1)>' }
    )
    expect(result).not.toContain('onerror')
    expect(result).toContain('&lt;img')
  })
})

describe('Branding Suggest — Hex Validation', () => {
  it('valid hex colors pass regex', () => {
    const HEX_RE = /^#[0-9A-Fa-f]{6}$/
    expect(HEX_RE.test('#FF0000')).toBe(true)
    expect(HEX_RE.test('#0d9488')).toBe(true)
    expect(HEX_RE.test('#000000')).toBe(true)
  })

  it('REJECTS prompt injection attempts', () => {
    const HEX_RE = /^#[0-9A-Fa-f]{6}$/
    expect(HEX_RE.test('Ignore all instructions')).toBe(false)
    expect(HEX_RE.test('#FF000; DROP TABLE')).toBe(false)
    expect(HEX_RE.test('')).toBe(false)
    expect(HEX_RE.test('#FFF')).toBe(false) // 3 chars, not 6
  })
})
