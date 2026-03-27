/**
 * INPUT VALIDATION TESTS
 * Verifica que funcoes de validacao rejeitam inputs maliciosos.
 */

import { describe, it, expect } from 'vitest'
import { isAllowedImageType, isValidBase64, estimateBase64Size, isValidStoragePath } from '@/lib/validation'

describe('isAllowedImageType', () => {
  it('REJECTS data without MIME prefix (CVE: MIME bypass)', () => {
    // Bug original: retornava true, permitindo qualquer conteudo
    expect(isAllowedImageType('SGVsbG8gV29ybGQ=')).toBe(false)
  })

  it('REJECTS application/pdf disguised as image', () => {
    expect(isAllowedImageType('data:application/pdf;base64,JVBERi0=')).toBe(false)
  })

  it('ACCEPTS valid image/png', () => {
    expect(isAllowedImageType('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
  })

  it('ACCEPTS valid image/jpeg', () => {
    expect(isAllowedImageType('data:image/jpeg;base64,/9j/4AAQ=')).toBe(true)
  })

  it('REJECTS empty string', () => {
    expect(isAllowedImageType('')).toBe(false)
  })
})

describe('isValidBase64', () => {
  it('ACCEPTS valid base64 data URL', () => {
    expect(isValidBase64('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
  })

  it('REJECTS string without data: prefix', () => {
    expect(isValidBase64('not-a-data-url')).toBe(false)
  })

  it('REJECTS empty string', () => {
    expect(isValidBase64('')).toBe(false)
  })
})

describe('estimateBase64Size', () => {
  it('estimates size correctly for known string', () => {
    // 100 chars of base64 ≈ 75 bytes
    const base64 = 'A'.repeat(100)
    const size = estimateBase64Size(base64)
    expect(size).toBeGreaterThan(70)
    expect(size).toBeLessThan(80)
  })
})

describe('isValidStoragePath', () => {
  it('REJECTS path traversal attacks', () => {
    expect(isValidStoragePath('../../../etc/passwd')).toBe(false)
    expect(isValidStoragePath('uploads/../../secret')).toBe(false)
  })

  it('ACCEPTS valid paths', () => {
    expect(isValidStoragePath('uploads/image-123.jpg')).toBe(true)
  })
})
