/**
 * RATE LIMIT INTEGRATION — Verifica que as instancias pre-configuradas existem
 */

import { describe, it, expect } from 'vitest'
import { billingLimiter, authLimiter, aiLimiter, getRequestIdentifier } from '@/lib/rateLimit'

describe('Pre-configured rate limiters', () => {
  it('billingLimiter allows 10 requests', () => {
    for (let i = 0; i < 10; i++) {
      expect(billingLimiter.check(`billing-test-${Date.now()}-${i}`).success).toBe(true)
    }
  })

  it('authLimiter allows 5 requests', () => {
    const id = `auth-test-${Date.now()}`
    for (let i = 0; i < 5; i++) {
      expect(authLimiter.check(id).success).toBe(true)
    }
    expect(authLimiter.check(id).success).toBe(false)
  })

  it('aiLimiter allows 3 requests', () => {
    const id = `ai-test-${Date.now()}`
    for (let i = 0; i < 3; i++) {
      expect(aiLimiter.check(id).success).toBe(true)
    }
    expect(aiLimiter.check(id).success).toBe(false)
  })
})

describe('getRequestIdentifier', () => {
  it('uses userId when provided', () => {
    const req = { headers: new Headers() } as unknown as Request
    expect(getRequestIdentifier(req, 'user-123')).toBe('user-123')
  })

  it('falls back to x-forwarded-for header', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }) } as unknown as Request
    expect(getRequestIdentifier(req)).toBe('1.2.3.4')
  })

  it('returns anonymous as last resort', () => {
    const req = { headers: new Headers() } as unknown as Request
    expect(getRequestIdentifier(req)).toBe('anonymous')
  })
})
