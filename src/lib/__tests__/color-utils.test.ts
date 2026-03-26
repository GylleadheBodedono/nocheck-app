// ============================================
// Testes: color-utils (darkenColor, hexToRgb)
// ============================================

import { describe, it, expect } from 'vitest'
import { darkenColor, hexToRgb } from '../color-utils'

describe('darkenColor', () => {
  it('escurece cor com amount padrao (15%)', () => {
    const result = darkenColor('#ffffff')
    // 255 * 0.85 = 216.75 → 217 = 0xd9
    expect(result).toBe('#d9d9d9')
  })

  it('escurece cor com amount customizado', () => {
    const result = darkenColor('#ffffff', 0.5)
    // 255 * 0.5 = 127.5 → 128 = 0x80
    expect(result).toBe('#808080')
  })

  it('nao produz valores negativos', () => {
    const result = darkenColor('#010101', 0.99)
    expect(result).toBe('#000000')
  })

  it('retorna mesma cor com amount 0', () => {
    const result = darkenColor('#0D9488', 0)
    expect(result).toBe('#0d9488')
  })

  it('retorna preto com amount 1', () => {
    const result = darkenColor('#ff8800', 1)
    expect(result).toBe('#000000')
  })

  it('funciona com cor primaria do app', () => {
    const result = darkenColor('#0D9488')
    // Deve retornar cor mais escura, nao a mesma
    expect(result).not.toBe('#0d9488')
    // Deve continuar sendo hex valido
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('aceita hex sem #', () => {
    const withHash = darkenColor('#ff0000', 0.5)
    const withoutHash = darkenColor('ff0000', 0.5)
    expect(withHash).toBe(withoutHash)
  })
})

describe('hexToRgb', () => {
  it('converte branco', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('converte preto', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })

  it('converte vermelho puro', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
  })

  it('converte verde puro', () => {
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
  })

  it('converte azul puro', () => {
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 })
  })

  it('converte cor primaria do app', () => {
    expect(hexToRgb('#0D9488')).toEqual({ r: 13, g: 148, b: 136 })
  })

  it('aceita hex sem #', () => {
    expect(hexToRgb('0D9488')).toEqual({ r: 13, g: 148, b: 136 })
  })
})
