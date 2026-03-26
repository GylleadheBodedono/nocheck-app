// ============================================
// Testes — Validacao de Caminhos no Storage
// ============================================
// Valida a funcao isValidStoragePath que protege
// contra path traversal e acesso a pastas nao autorizadas.
// ============================================

import { describe, it, expect } from 'vitest'
import { isValidStoragePath, ALLOWED_STORAGE_FOLDERS } from '@/lib/validation'

// ─── Caminhos permitidos ───

describe('isValidStoragePath — caminhos permitidos', () => {
  it('aceita "uploads"', () => {
    expect(isValidStoragePath('uploads')).toBe(true)
  })

  it('aceita "uploads/photos"', () => {
    expect(isValidStoragePath('uploads/photos')).toBe(true)
  })

  it('aceita "uploads/2024/01/image.jpg"', () => {
    expect(isValidStoragePath('uploads/2024/01/image.jpg')).toBe(true)
  })

  it('aceita "anexos"', () => {
    expect(isValidStoragePath('anexos')).toBe(true)
  })

  it('aceita "anexos/docs"', () => {
    expect(isValidStoragePath('anexos/docs')).toBe(true)
  })

  it('aceita "anexos/planos/arquivo.pdf"', () => {
    expect(isValidStoragePath('anexos/planos/arquivo.pdf')).toBe(true)
  })
})

// ─── Caminhos rejeitados: pasta nao permitida ───

describe('isValidStoragePath — pastas nao permitidas', () => {
  it('rejeita "private/secret"', () => {
    expect(isValidStoragePath('private/secret')).toBe(false)
  })

  it('rejeita "public/images"', () => {
    expect(isValidStoragePath('public/images')).toBe(false)
  })

  it('rejeita "temp"', () => {
    expect(isValidStoragePath('temp')).toBe(false)
  })

  it('rejeita string vazia', () => {
    expect(isValidStoragePath('')).toBe(false)
  })

  it('rejeita "uploadsXXX" (prefixo similar mas sem separador)', () => {
    expect(isValidStoragePath('uploadsXXX')).toBe(false)
  })

  it('rejeita "anexosExtra" (prefixo similar mas sem separador)', () => {
    expect(isValidStoragePath('anexosExtra')).toBe(false)
  })

  it('rejeita "/uploads" (barra no inicio)', () => {
    expect(isValidStoragePath('/uploads')).toBe(false)
  })
})

// ─── Caminhos rejeitados: path traversal ───

describe('isValidStoragePath — protecao contra path traversal', () => {
  it('rejeita "uploads/../etc/passwd"', () => {
    expect(isValidStoragePath('uploads/../etc/passwd')).toBe(false)
  })

  it('rejeita "anexos/../../../secret"', () => {
    expect(isValidStoragePath('anexos/../../../secret')).toBe(false)
  })

  it('rejeita "uploads/foo/../../bar"', () => {
    expect(isValidStoragePath('uploads/foo/../../bar')).toBe(false)
  })
})

// ─── Caminhos rejeitados: barra dupla ───

describe('isValidStoragePath — protecao contra barra dupla', () => {
  it('rejeita "uploads//hidden"', () => {
    expect(isValidStoragePath('uploads//hidden')).toBe(false)
  })

  it('rejeita "anexos//deep//path"', () => {
    expect(isValidStoragePath('anexos//deep//path')).toBe(false)
  })

  it('rejeita "uploads//"', () => {
    expect(isValidStoragePath('uploads//')).toBe(false)
  })
})

// ─── Constantes ───

describe('ALLOWED_STORAGE_FOLDERS', () => {
  it('contem exatamente uploads e anexos', () => {
    expect(ALLOWED_STORAGE_FOLDERS).toEqual(['uploads', 'anexos'])
  })

  it('tem 2 entradas', () => {
    expect(ALLOWED_STORAGE_FOLDERS).toHaveLength(2)
  })
})
