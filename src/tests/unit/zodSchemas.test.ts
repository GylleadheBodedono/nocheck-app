/**
 * ZOD BILLING SCHEMAS — Unit Tests
 */

import { describe, it, expect } from 'vitest'
import { changePlanSchema, checkoutSchema, subscribeSchema, checkEmailSchema, validateBody } from '@/lib/billingSchemas'

describe('changePlanSchema', () => {
  it('accepts valid input', () => {
    const result = changePlanSchema.safeParse({ orgId: '550e8400-e29b-41d4-a716-446655440000', newPlan: 'professional' })
    expect(result.success).toBe(true)
  })

  it('rejects missing orgId', () => {
    const result = changePlanSchema.safeParse({ newPlan: 'professional' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid plan', () => {
    const result = changePlanSchema.safeParse({ orgId: '550e8400-e29b-41d4-a716-446655440000', newPlan: 'super-duper' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID orgId', () => {
    const result = changePlanSchema.safeParse({ orgId: 'not-a-uuid', newPlan: 'starter' })
    expect(result.success).toBe(false)
  })
})

describe('checkoutSchema', () => {
  it('accepts valid input with optional fields', () => {
    const result = checkoutSchema.safeParse({ orgId: '550e8400-e29b-41d4-a716-446655440000', priceId: 'price_123' })
    expect(result.success).toBe(true)
  })

  it('rejects empty priceId', () => {
    const result = checkoutSchema.safeParse({ orgId: '550e8400-e29b-41d4-a716-446655440000', priceId: '' })
    expect(result.success).toBe(false)
  })
})

describe('subscribeSchema', () => {
  it('rejects missing paymentMethodId', () => {
    const result = subscribeSchema.safeParse({ orgId: '550e8400-e29b-41d4-a716-446655440000', priceId: 'price_123' })
    expect(result.success).toBe(false)
  })
})

describe('checkEmailSchema', () => {
  it('accepts valid email', () => {
    const result = checkEmailSchema.safeParse({ email: 'test@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = checkEmailSchema.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects empty email', () => {
    const result = checkEmailSchema.safeParse({ email: '' })
    expect(result.success).toBe(false)
  })
})

describe('validateBody helper', () => {
  it('returns data on valid input', () => {
    const result = validateBody(changePlanSchema, { orgId: '550e8400-e29b-41d4-a716-446655440000', newPlan: 'starter' })
    expect(result.data).toBeDefined()
    expect(result.error).toBeUndefined()
  })

  it('returns error string on invalid input', () => {
    const result = validateBody(changePlanSchema, { orgId: 'bad', newPlan: 'fake' })
    expect(result.error).toBeDefined()
    expect(typeof result.error).toBe('string')
  })
})
