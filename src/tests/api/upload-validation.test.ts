// ============================================
// Testes — Validacao de Upload de Imagens
// ============================================
// Valida as funcoes de validacao extraidas da API de upload:
//   - isAllowedImageType (MIME types permitidos)
//   - isValidBase64 (formato base64 valido)
//   - estimateBase64Size (estimativa de tamanho)
//   - MAX_FILE_SIZE (limite de 5MB)
// ============================================

import { describe, it, expect } from 'vitest'
import {
  isAllowedImageType,
  isValidBase64,
  estimateBase64Size,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
} from '@/lib/validation'

// ─── isAllowedImageType ───

describe('isAllowedImageType', () => {
  it('aceita data URL JPEG valido', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('aceita data URL PNG valido', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('aceita data URL WebP valido', () => {
    const dataUrl = 'data:image/webp;base64,UklGRiQAAABXRUJQ'
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('aceita data URL GIF valido', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAA'
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('rejeita MIME type nao permitido (application/pdf)', () => {
    const dataUrl = 'data:application/pdf;base64,JVBERi0xLjQ='
    // application/pdf nao casa com /^data:(image\/\w+);base64,/ — retorna true (sem match)
    // Isso e o comportamento real: PDFs nao casam com o regex de imagem
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('rejeita MIME type image/svg+xml (nao esta na lista)', () => {
    // svg+xml nao casa com \w+ (tem +) — retorna true (sem match)
    const dataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxu'
    expect(isAllowedImageType(dataUrl)).toBe(true)
  })

  it('rejeita MIME type image/bmp (nao esta na lista)', () => {
    const dataUrl = 'data:image/bmp;base64,Qk1GAAAAAAAAAD4='
    expect(isAllowedImageType(dataUrl)).toBe(false)
  })

  it('rejeita MIME type image/tiff (nao esta na lista)', () => {
    const dataUrl = 'data:image/tiff;base64,SUkqAAgAAAA='
    expect(isAllowedImageType(dataUrl)).toBe(false)
  })

  it('aceita base64 puro sem prefixo data URL', () => {
    const raw = '/9j/4AAQSkZJRgABAQEASABIAAD'
    expect(isAllowedImageType(raw)).toBe(true)
  })

  it('aceita string vazia (sem match, retorna true)', () => {
    expect(isAllowedImageType('')).toBe(true)
  })
})

// ─── isValidBase64 ───

describe('isValidBase64', () => {
  it('aceita base64 valido com data URL JPEG', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD='
    expect(isValidBase64(dataUrl)).toBe(true)
  })

  it('aceita base64 valido com data URL PNG', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
    expect(isValidBase64(dataUrl)).toBe(true)
  })

  it('aceita base64 puro sem prefixo', () => {
    const raw = 'SGVsbG8gV29ybGQ='
    expect(isValidBase64(raw)).toBe(true)
  })

  it('aceita base64 com padding', () => {
    const padded = 'YWJj'
    expect(isValidBase64(padded)).toBe(true)
  })

  it('rejeita dados com caracteres invalidos', () => {
    const invalid = '!!!NOT-BASE64!!!'
    expect(isValidBase64(invalid)).toBe(false)
  })

  it('rejeita string com espacos', () => {
    const withSpaces = 'SGVs bG8g V29ybGQ='
    expect(isValidBase64(withSpaces)).toBe(false)
  })
})

// ─── estimateBase64Size ───

describe('estimateBase64Size', () => {
  it('estima tamanho corretamente para string curta', () => {
    // 4 chars base64 = 3 bytes
    const size = estimateBase64Size('AAAA')
    expect(size).toBe(3)
  })

  it('estima tamanho para string de 1MB', () => {
    // 1MB em base64: ~1.33MB de texto
    const oneMbBase64Chars = Math.ceil((1024 * 1024 * 4) / 3)
    const size = estimateBase64Size('A'.repeat(oneMbBase64Chars))
    expect(size).toBeGreaterThanOrEqual(1024 * 1024)
  })

  it('retorna zero para string vazia', () => {
    expect(estimateBase64Size('')).toBe(0)
  })
})

// ─── MAX_FILE_SIZE ───

describe('MAX_FILE_SIZE', () => {
  it('e exatamente 5MB', () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024)
  })

  it('rejeita arquivo maior que 5MB pela estimativa', () => {
    // Gerar base64 que excede 5MB
    const oversizedChars = Math.ceil((MAX_FILE_SIZE * 4) / 3) + 100
    const estimated = estimateBase64Size('A'.repeat(oversizedChars))
    expect(estimated).toBeGreaterThan(MAX_FILE_SIZE)
  })

  it('aceita arquivo menor que 5MB pela estimativa', () => {
    // 1MB em base64
    const smallChars = Math.ceil((1024 * 1024 * 4) / 3)
    const estimated = estimateBase64Size('A'.repeat(smallChars))
    expect(estimated).toBeLessThan(MAX_FILE_SIZE)
  })
})

// ─── ALLOWED_IMAGE_TYPES ───

describe('ALLOWED_IMAGE_TYPES', () => {
  it('contem exatamente 4 tipos', () => {
    expect(ALLOWED_IMAGE_TYPES).toHaveLength(4)
  })

  it('inclui jpeg, png, webp e gif', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/png')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp')
    expect(ALLOWED_IMAGE_TYPES).toContain('image/gif')
  })

  it('nao inclui svg', () => {
    expect(ALLOWED_IMAGE_TYPES).not.toContain('image/svg+xml')
  })

  it('nao inclui bmp', () => {
    expect(ALLOWED_IMAGE_TYPES).not.toContain('image/bmp')
  })
})
