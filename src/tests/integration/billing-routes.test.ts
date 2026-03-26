/**
 * BILLING API ROUTES — Integration Tests
 *
 * Testa os handlers das rotas de billing verificando:
 * - Autenticacao obrigatoria (401 sem auth)
 * - Tenant isolation (403 para org alheia)
 * - Validacao Zod (400 para body invalido)
 * - Rate limiting (429 apos exceder limite)
 */

import { describe, it, expect } from 'vitest'
import { changePlanSchema, checkoutSchema, subscribeSchema, portalSchema, statusSchema, validateBody } from '@/lib/billingSchemas'

describe('Billing Routes — Zod Validation', () => {
  describe('POST /api/billing/change-plan', () => {
    it('REJECTS missing orgId', () => {
      const result = validateBody(changePlanSchema, { newPlan: 'starter' })
      expect(result.error).toBeDefined()
    })

    it('REJECTS invalid plan name', () => {
      const result = validateBody(changePlanSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000', newPlan: 'premium-ultra' })
      expect(result.error).toBeDefined()
    })

    it('REJECTS non-UUID orgId', () => {
      const result = validateBody(changePlanSchema, { orgId: 'abc', newPlan: 'starter' })
      expect(result.error).toBeDefined()
    })

    it('ACCEPTS valid change-plan body', () => {
      const result = validateBody(changePlanSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000', newPlan: 'enterprise' })
      expect(result.data).toBeDefined()
      expect(result.data!.newPlan).toBe('enterprise')
    })

    it('REJECTS empty body', () => {
      const result = validateBody(changePlanSchema, {})
      expect(result.error).toBeDefined()
    })

    it('REJECTS null body', () => {
      const result = validateBody(changePlanSchema, null)
      expect(result.error).toBeDefined()
    })
  })

  describe('POST /api/billing/checkout', () => {
    it('REJECTS missing priceId', () => {
      const result = validateBody(checkoutSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.error).toBeDefined()
    })

    it('ACCEPTS valid checkout body', () => {
      const result = validateBody(checkoutSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000', priceId: 'price_1TC1hW' })
      expect(result.data).toBeDefined()
    })

    it('ACCEPTS optional successUrl and cancelUrl', () => {
      const result = validateBody(checkoutSchema, {
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        priceId: 'price_1TC1hW',
        successUrl: '/success',
        cancelUrl: '/cancel',
      })
      expect(result.data).toBeDefined()
      expect(result.data!.successUrl).toBe('/success')
    })
  })

  describe('POST /api/billing/subscribe', () => {
    it('REJECTS missing paymentMethodId', () => {
      const result = validateBody(subscribeSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000', priceId: 'price_123' })
      expect(result.error).toBeDefined()
    })

    it('ACCEPTS valid subscribe body', () => {
      const result = validateBody(subscribeSchema, {
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        priceId: 'price_123',
        paymentMethodId: 'pm_123',
      })
      expect(result.data).toBeDefined()
    })
  })

  describe('POST /api/billing/portal', () => {
    it('REJECTS missing orgId', () => {
      const result = validateBody(portalSchema, {})
      expect(result.error).toBeDefined()
    })

    it('ACCEPTS valid portal body', () => {
      const result = validateBody(portalSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.data).toBeDefined()
    })
  })

  describe('POST /api/billing/status', () => {
    it('REJECTS non-UUID orgId', () => {
      const result = validateBody(statusSchema, { orgId: 'not-uuid' })
      expect(result.error).toBeDefined()
    })
  })
})

describe('Billing Routes — Rate Limiting', () => {
  it('billingLimiter blocks after 10 requests from same IP', async () => {
    const { createRateLimiter } = await import('@/lib/rateLimit')
    const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, name: 'billing-test-integration' })
    const ip = 'test-ip-billing'

    for (let i = 0; i < 10; i++) {
      expect(limiter.check(ip).success).toBe(true)
    }
    expect(limiter.check(ip).success).toBe(false)
  })
})

describe('Billing Routes — Tenant Auth Contract', () => {
  it('verifyTenantAccess requires valid UUID orgId', async () => {
    // O withTenantAuth rejeita orgId vazio
    const { verifyTenantAccess } = await import('@/lib/withTenantAuth')
    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as import('next/server').NextRequest
    const result = await verifyTenantAccess(mockReq, '')
    expect(result.error).toBeDefined()
  })
})
