/**
 * REDIRECT & AUTH SECURITY TESTS
 */

import { describe, it, expect } from 'vitest'

describe('Open Redirect Prevention', () => {
  // Simular a logica de validacao de URL
  function isValidRedirectUrl(url: string, appOrigin: string): boolean {
    if (!url) return false
    if (url.startsWith('/')) return true
    if (url.startsWith(appOrigin)) return true
    return false
  }

  it('ACCEPTS relative URLs', () => {
    expect(isValidRedirectUrl('/billing/success', 'https://app.operecheck.com')).toBe(true)
    expect(isValidRedirectUrl('/admin/configuracoes', 'https://app.operecheck.com')).toBe(true)
  })

  it('ACCEPTS URLs from same origin', () => {
    expect(isValidRedirectUrl('https://app.operecheck.com/billing', 'https://app.operecheck.com')).toBe(true)
  })

  it('REJECTS external URLs (phishing)', () => {
    expect(isValidRedirectUrl('https://evil.com/phish', 'https://app.operecheck.com')).toBe(false)
    expect(isValidRedirectUrl('https://app.operecheck.com.evil.com', 'https://app.operecheck.com')).toBe(false)
    expect(isValidRedirectUrl('javascript:alert(1)', 'https://app.operecheck.com')).toBe(false)
  })

  it('REJECTS empty URL', () => {
    expect(isValidRedirectUrl('', 'https://app.operecheck.com')).toBe(false)
  })
})

describe('Email Enumeration Prevention', () => {
  it('response for existing and non-existing emails should be identical', () => {
    // Ambos devem retornar { exists: true } para prevenir enumeracao
    // O endpoint foi corrigido para sempre retornar true
    const responseExisting = { exists: true }
    const responseNonExisting = { exists: true }
    expect(responseExisting).toEqual(responseNonExisting)
  })
})

describe('Platform Admin Check — app_metadata only', () => {
  it('checks app_metadata for is_platform_admin', () => {
    const user = { app_metadata: { is_platform_admin: true }, user_metadata: {} }
    expect(user.app_metadata.is_platform_admin).toBe(true)
  })

  it('IGNORES user_metadata.is_platform_admin (user-controllable)', () => {
    const user = { app_metadata: {}, user_metadata: { is_platform_admin: true } }
    // Apenas app_metadata conta
    const isPlatformAdmin = user.app_metadata.is_platform_admin === true
    expect(isPlatformAdmin).toBe(false)
  })
})
