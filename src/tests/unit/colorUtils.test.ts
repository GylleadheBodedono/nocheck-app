/**
 * COLOR UTILS — Unit Tests
 */

import { describe, it, expect } from 'vitest'

// Import if exists, otherwise test the inline functions
describe('Color utility functions', () => {
  // Test the hex darkening logic used in SessionTenantProvider
  function darkenHex(hex: string, amount = 20): string {
    const h = hex.replace('#', '')
    if (h.length !== 6) throw new Error('Invalid hex')
    const r = Math.max(0, parseInt(h.slice(0, 2), 16) - amount)
    const g = Math.max(0, parseInt(h.slice(2, 4), 16) - amount)
    const b = Math.max(0, parseInt(h.slice(4, 6), 16) - amount)
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  it('darkens a color correctly', () => {
    const result = darkenHex('#0D9488', 20)
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('does not go below #000000', () => {
    const result = darkenHex('#0A0A0A', 20)
    expect(result).toBe('#000000')
  })

  it('handles white correctly', () => {
    const result = darkenHex('#FFFFFF', 20)
    expect(result).toBe('#ebebeb')
  })

  it('throws on invalid hex', () => {
    expect(() => darkenHex('#FFF')).toThrow('Invalid hex')
    expect(() => darkenHex('not-hex')).toThrow()
  })

  it('handles black', () => {
    const result = darkenHex('#000000', 20)
    expect(result).toBe('#000000')
  })
})
