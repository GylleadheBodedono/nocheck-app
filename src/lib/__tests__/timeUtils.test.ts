import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, isWithinTimeRange } from '../timeUtils'

// Helper: cria Date com hora/minuto especificos
function at(hours: number, minutes: number): Date {
  const d = new Date(2026, 0, 15, hours, minutes, 0)
  return d
}

describe('parseTimeToMinutes', () => {
  it('converte HH:MM', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0)
    expect(parseTimeToMinutes('08:30')).toBe(510)
    expect(parseTimeToMinutes('21:00')).toBe(1260)
    expect(parseTimeToMinutes('23:59')).toBe(1439)
  })

  it('converte HH:MM:SS (ignora segundos)', () => {
    expect(parseTimeToMinutes('21:00:00')).toBe(1260)
    expect(parseTimeToMinutes('02:00:00')).toBe(120)
  })
})

describe('isWithinTimeRange', () => {
  describe('range no mesmo dia (08:00 → 18:00)', () => {
    const start = '08:00'
    const end = '18:00'

    it('permite horario dentro do range', () => {
      expect(isWithinTimeRange(start, end, at(8, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(12, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(18, 0))).toBe(true)
    })

    it('bloqueia horario fora do range', () => {
      expect(isWithinTimeRange(start, end, at(7, 59))).toBe(false)
      expect(isWithinTimeRange(start, end, at(18, 1))).toBe(false)
      expect(isWithinTimeRange(start, end, at(0, 0))).toBe(false)
      expect(isWithinTimeRange(start, end, at(23, 59))).toBe(false)
    })
  })

  describe('range overnight (21:00 → 02:00)', () => {
    const start = '21:00'
    const end = '02:00'

    it('permite horario a noite (apos start)', () => {
      expect(isWithinTimeRange(start, end, at(21, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(23, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(23, 59))).toBe(true)
    })

    it('permite horario de madrugada (antes de end)', () => {
      expect(isWithinTimeRange(start, end, at(0, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(0, 21))).toBe(true)  // o caso do bug reportado
      expect(isWithinTimeRange(start, end, at(1, 30))).toBe(true)
      expect(isWithinTimeRange(start, end, at(2, 0))).toBe(true)
    })

    it('bloqueia horario fora do range', () => {
      expect(isWithinTimeRange(start, end, at(2, 1))).toBe(false)
      expect(isWithinTimeRange(start, end, at(3, 0))).toBe(false)
      expect(isWithinTimeRange(start, end, at(15, 0))).toBe(false)
      expect(isWithinTimeRange(start, end, at(20, 59))).toBe(false)
    })
  })

  describe('range overnight (22:00 → 06:00)', () => {
    const start = '22:00'
    const end = '06:00'

    it('permite dentro', () => {
      expect(isWithinTimeRange(start, end, at(22, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(0, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(5, 59))).toBe(true)
      expect(isWithinTimeRange(start, end, at(6, 0))).toBe(true)
    })

    it('bloqueia fora', () => {
      expect(isWithinTimeRange(start, end, at(6, 1))).toBe(false)
      expect(isWithinTimeRange(start, end, at(12, 0))).toBe(false)
      expect(isWithinTimeRange(start, end, at(21, 59))).toBe(false)
    })
  })

  describe('range ate meia-noite (22:00 → 00:00)', () => {
    const start = '22:00'
    const end = '00:00'

    it('permite dentro', () => {
      expect(isWithinTimeRange(start, end, at(22, 0))).toBe(true)
      expect(isWithinTimeRange(start, end, at(23, 30))).toBe(true)
      expect(isWithinTimeRange(start, end, at(0, 0))).toBe(true)
    })

    it('bloqueia fora', () => {
      expect(isWithinTimeRange(start, end, at(0, 1))).toBe(false)
      expect(isWithinTimeRange(start, end, at(21, 59))).toBe(false)
    })
  })

  describe('dia inteiro e limites', () => {
    it('range 00:00 → 23:59 permite qualquer horario', () => {
      expect(isWithinTimeRange('00:00', '23:59', at(0, 0))).toBe(true)
      expect(isWithinTimeRange('00:00', '23:59', at(12, 0))).toBe(true)
      expect(isWithinTimeRange('00:00', '23:59', at(23, 59))).toBe(true)
    })

    it('range igual (14:00 → 14:00) permite apenas 14:00', () => {
      expect(isWithinTimeRange('14:00', '14:00', at(14, 0))).toBe(true)
      expect(isWithinTimeRange('14:00', '14:00', at(14, 1))).toBe(false)
      expect(isWithinTimeRange('14:00', '14:00', at(13, 59))).toBe(false)
    })
  })

  describe('formatos com segundos (HH:MM:SS)', () => {
    it('funciona com formato HH:MM:SS', () => {
      expect(isWithinTimeRange('21:00:00', '02:00:00', at(0, 21))).toBe(true)
      expect(isWithinTimeRange('08:00:00', '18:00:00', at(12, 0))).toBe(true)
      expect(isWithinTimeRange('08:00:00', '18:00:00', at(20, 0))).toBe(false)
    })
  })
})
