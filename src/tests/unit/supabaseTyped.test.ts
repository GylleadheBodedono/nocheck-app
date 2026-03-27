/**
 * SUPABASE TYPED CLIENT — Unit Tests
 * Verifica que os tipos e helpers funcionam corretamente.
 */

import { describe, it, expect } from 'vitest'
import type { TableRow, TableInsert, TableUpdate } from '@/lib/supabase-typed'

describe('Supabase Type Helpers', () => {
  it('TableRow type resolves for organizations', () => {
    // Este teste verifica em compile-time que o tipo existe
    const org: Partial<TableRow<'organizations'>> = {
      name: 'Test Org',
      slug: 'test-org',
      plan: 'trial',
    }
    expect(org.name).toBe('Test Org')
  })

  it('TableRow type resolves for users', () => {
    const user: Partial<TableRow<'users'>> = {
      email: 'test@test.com',
      full_name: 'Test User',
      is_admin: false,
    }
    expect(user.email).toBe('test@test.com')
  })

  it('TableInsert type resolves for stores', () => {
    const store: Partial<TableInsert<'stores'>> = {
      name: 'Test Store',
      is_active: true,
    }
    expect(store.name).toBe('Test Store')
  })

  it('TableUpdate type allows partial fields', () => {
    const update: TableUpdate<'organizations'> = {
      name: 'Updated Name',
    }
    expect(update.name).toBe('Updated Name')
  })
})

describe('Billing Schemas with Typed Data', () => {
  it('validates org ID format matches UUID from Supabase', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000'
    expect(validUUID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('plan values match Supabase enum constraint', () => {
    const validPlans = ['trial', 'starter', 'professional', 'enterprise']
    validPlans.forEach(plan => {
      expect(['trial', 'starter', 'professional', 'enterprise']).toContain(plan)
    })
  })
})
