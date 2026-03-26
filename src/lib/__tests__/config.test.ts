// ============================================
// Testes: config (APP_CONFIG, getTenant helpers)
// ============================================

import { describe, it, expect } from 'vitest'
import {
  APP_CONFIG,
  getTenantAppName,
  getTenantPrimaryColor,
  getTenantLogoUrl,
  getTenantFaviconUrl,
} from '../config'

describe('APP_CONFIG', () => {
  it('tem nome do app definido', () => {
    expect(APP_CONFIG.name).toBe('OpereCheck')
  })

  it('tem versao definida', () => {
    expect(APP_CONFIG.version).toBeTruthy()
  })

  it('tem rotas essenciais', () => {
    expect(APP_CONFIG.routes.login).toBe('/login')
    expect(APP_CONFIG.routes.dashboard).toBe('/dashboard')
    expect(APP_CONFIG.routes.admin).toBe('/admin')
  })

  it('tem mensagens de loading e erro', () => {
    expect(APP_CONFIG.messages.loading).toBeTruthy()
    expect(APP_CONFIG.messages.error).toBeTruthy()
  })

  it('tem categorias de templates', () => {
    expect(APP_CONFIG.templateCategories.length).toBeGreaterThan(0)
    expect(APP_CONFIG.templateCategories[0]).toHaveProperty('value')
    expect(APP_CONFIG.templateCategories[0]).toHaveProperty('label')
  })
})

describe('getTenantAppName', () => {
  it('retorna nome do tenant quando tem settings', () => {
    const org = { settings: { theme: { appName: 'MinhaEmpresa' } } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getTenantAppName(org as any)).toBe('MinhaEmpresa')
  })

  it('retorna fallback quando org e null', () => {
    expect(getTenantAppName(null)).toBe(APP_CONFIG.name)
  })

  it('retorna fallback quando settings e undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(getTenantAppName({} as any)).toBe(APP_CONFIG.name)
  })

  it('retorna fallback quando theme e vazio', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: {} } } as any
    expect(getTenantAppName(org)).toBe(APP_CONFIG.name)
  })
})

describe('getTenantPrimaryColor', () => {
  it('retorna cor do tenant quando definida', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: { primaryColor: '#ff0000' } } } as any
    expect(getTenantPrimaryColor(org)).toBe('#ff0000')
  })

  it('retorna cor padrao quando org e null', () => {
    const color = getTenantPrimaryColor(null)
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('retorna cor padrao quando theme nao tem primaryColor', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: {} } } as any
    const color = getTenantPrimaryColor(org)
    expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

describe('getTenantLogoUrl', () => {
  it('retorna URL do logo quando definida', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: { logoUrl: 'https://example.com/logo.png' } } } as any
    expect(getTenantLogoUrl(org)).toBe('https://example.com/logo.png')
  })

  it('retorna null quando org e null', () => {
    expect(getTenantLogoUrl(null)).toBeNull()
  })

  it('retorna null quando theme nao tem logoUrl', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: {} } } as any
    expect(getTenantLogoUrl(org)).toBeNull()
  })
})

describe('getTenantFaviconUrl', () => {
  it('retorna URL do favicon quando definida', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: { theme: { faviconUrl: 'https://example.com/fav.ico' } } } as any
    expect(getTenantFaviconUrl(org)).toBe('https://example.com/fav.ico')
  })

  it('retorna null quando org e null', () => {
    expect(getTenantFaviconUrl(null)).toBeNull()
  })

  it('retorna null quando theme nao tem faviconUrl', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = { settings: {} } as any
    expect(getTenantFaviconUrl(org)).toBeNull()
  })
})
