import { describe, it, expect } from 'vitest'
import { _verificarNotasIrmas } from '@/lib/crossValidation'

/**
 * Helper: creates a Date offset by `minutes` from a base date.
 */
function dateWithOffset(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60 * 1000)
}

const BASE_DATE = new Date('2025-06-15T10:00:00Z')

describe('verificarNotasIrmas', () => {
  // ─── 1. Exact prefix match within 30 min window ───────────────────────────

  describe('exact prefix match within 30 min window', () => {
    it('matches notes with same 3-digit prefix and 5 min difference', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12389',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 5)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
      expect(result.reason).toContain('5')
    })

    it('matches notes with same 3-digit prefix and 25 min difference', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12389',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 25)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
      expect(result.reason).toContain('25')
    })

    it('does NOT match notes with same prefix but 35 min difference (outside window)', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12389',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 35)
      )
      expect(result.match).toBe(false)
      expect(result.reason).toBe('')
    })
  })

  // ─── 2. Different prefix within 10 min (weak match) ───────────────────────

  describe('different prefix within 10 min (weak match)', () => {
    it('matches notes with different prefix but only 5 min apart', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '98765',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 5)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('erro de digitação')
    })

    it('does NOT match notes with different prefix and 15 min apart', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '98765',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 15)
      )
      expect(result.match).toBe(false)
      expect(result.reason).toBe('')
    })
  })

  // ─── 3. Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('matches when both notes are the same number', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12345',
        BASE_DATE,
        BASE_DATE
      )
      expect(result.match).toBe(true)
    })

    it('extracts digits correctly from notes with non-digit characters', () => {
      // "NF-123-45" → digits "12345", "NF-123-89" → digits "12389"
      const result = _verificarNotasIrmas(
        'NF-123-45',
        'NF-123-89',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 5)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
    })

    it('does NOT match very short notes (< 3 digits) even with close time', () => {
      // "12" has only 2 digits → prefix length < 3 → prefixoIgual is false
      // With 5 min apart (< 10 min), it would still be a weak match
      const result = _verificarNotasIrmas(
        '12',
        '12',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 5)
      )
      // Prefix check fails because length < 3, but weak match triggers at < 10 min
      expect(result.match).toBe(true)
      expect(result.reason).toContain('erro de digitação')
    })

    it('does NOT match very short notes (< 3 digits) when time > 10 min', () => {
      const result = _verificarNotasIrmas(
        '12',
        '12',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 15)
      )
      expect(result.match).toBe(false)
      expect(result.reason).toBe('')
    })

    it('matches at exact 30 min boundary (prefix equal)', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12389',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 30)
      )
      // diffMinutos <= 30 is true when exactly 30
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
    })

    it('matches at exact 10 min boundary (different prefix, weak match)', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '98765',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 10)
      )
      // diffMinutos <= 10 is true when exactly 10
      expect(result.match).toBe(true)
      expect(result.reason).toContain('erro de digitação')
    })

    it('matches with zero time difference and same prefix', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12399',
        BASE_DATE,
        BASE_DATE
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
      expect(result.reason).toContain('0')
    })

    it('matches with zero time difference and different prefix (weak match)', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '98765',
        BASE_DATE,
        BASE_DATE
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('erro de digitação')
    })

    it('handles reversed date order (data1 > data2)', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '12389',
        dateWithOffset(BASE_DATE, 5),
        BASE_DATE
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('123')
    })
  })

  // ─── 4. Reason string content ─────────────────────────────────────────────

  describe('reason string', () => {
    it('strong match reason contains the prefix and time difference', () => {
      const result = _verificarNotasIrmas(
        '45678',
        '45699',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 12)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('456')
      expect(result.reason).toContain('12')
      expect(result.reason).toMatch(/prefixo/)
    })

    it('weak match reason mentions "erro de digitação"', () => {
      const result = _verificarNotasIrmas(
        '11111',
        '99999',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 3)
      )
      expect(result.match).toBe(true)
      expect(result.reason).toContain('erro de digitação')
      expect(result.reason).toContain('3')
    })

    it('no match returns empty string as reason', () => {
      const result = _verificarNotasIrmas(
        '12345',
        '98765',
        BASE_DATE,
        dateWithOffset(BASE_DATE, 60)
      )
      expect(result.match).toBe(false)
      expect(result.reason).toBe('')
    })
  })
})
