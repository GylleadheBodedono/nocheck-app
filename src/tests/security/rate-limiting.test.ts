/**
 * RATE LIMITING TESTS
 */

import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '@/lib/rateLimit'

describe('Rate Limiter', () => {
  it('allows requests within limit', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000, name: 'test1' })
    for (let i = 0; i < 5; i++) {
      const result = limiter.check('user1')
      expect(result.success).toBe(true)
    }
  })

  it('blocks requests exceeding limit', () => {
    const limiter = createRateLimiter({ maxRequests: 3, windowMs: 60000, name: 'test2' })
    limiter.check('user2')
    limiter.check('user2')
    limiter.check('user2')
    const result = limiter.check('user2')
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('different identifiers have separate limits', () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 60000, name: 'test3' })
    limiter.check('userA')
    limiter.check('userA')
    const blockedA = limiter.check('userA')
    expect(blockedA.success).toBe(false)

    const allowedB = limiter.check('userB')
    expect(allowedB.success).toBe(true)
  })

  it('returns remaining count', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000, name: 'test4' })
    const r1 = limiter.check('user3')
    expect(r1.remaining).toBe(4)
    const r2 = limiter.check('user3')
    expect(r2.remaining).toBe(3)
  })

  it('provides resetAt timestamp', () => {
    const limiter = createRateLimiter({ maxRequests: 5, windowMs: 60000, name: 'test5' })
    const result = limiter.check('user4')
    expect(result.resetAt).toBeGreaterThan(Date.now())
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 60001)
  })
})
