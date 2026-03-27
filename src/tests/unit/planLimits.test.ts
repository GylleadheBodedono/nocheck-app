/**
 * PLAN LIMITS — Unit Tests
 * Verifica checkUserLimit e checkStoreLimit para cada tier.
 */

import { describe, it, expect } from 'vitest'
import { checkUserLimit, checkStoreLimit } from '@/lib/planLimits'

describe('checkUserLimit', () => {
  it('trial: 3 users max', () => {
    const result = checkUserLimit(2, 'trial')
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(3)
  })

  it('trial: at limit (3/3) blocks', () => {
    const result = checkUserLimit(3, 'trial')
    expect(result.allowed).toBe(false)
  })

  it('starter: 5 users max', () => {
    const result = checkUserLimit(4, 'starter')
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(5)
  })

  it('professional: 15 users max', () => {
    const result = checkUserLimit(14, 'professional')
    expect(result.allowed).toBe(true)
  })

  it('enterprise: 999 users (effectively unlimited)', () => {
    const result = checkUserLimit(500, 'enterprise')
    expect(result.allowed).toBe(true)
  })

  it('respects maxOverride when provided', () => {
    const result = checkUserLimit(8, 'starter', 10)
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(10)
  })
})

describe('checkStoreLimit', () => {
  it('trial: 1 store max', () => {
    const result = checkStoreLimit(0, 'trial')
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(1)
  })

  it('trial: at limit (1/1) blocks', () => {
    const result = checkStoreLimit(1, 'trial')
    expect(result.allowed).toBe(false)
  })

  it('starter: 3 stores max', () => {
    const result = checkStoreLimit(2, 'starter')
    expect(result.allowed).toBe(true)
  })

  it('enterprise: effectively unlimited', () => {
    const result = checkStoreLimit(100, 'enterprise')
    expect(result.allowed).toBe(true)
  })
})
