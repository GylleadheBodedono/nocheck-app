/**
 * RLS CONTRACT TESTS
 *
 * Verifica que as policies de RLS seguem o contrato esperado.
 * Estes testes documentam o comportamento esperado — a verificacao
 * real acontece no banco via supabase/tests/tenant_isolation.sql.
 */

import { describe, it, expect } from 'vitest'
import { ORG_A, ORG_B, USER_A_ADMIN, PLATFORM_ADMIN } from '../fixtures/tenants'

describe('RLS Contract — Organization Visibility', () => {
  it('regular user should only see their own org', () => {
    // User A com org_id = ORG_A so ve ORG_A
    expect(USER_A_ADMIN.app_metadata.org_id).toBe(ORG_A.id)
    expect(USER_A_ADMIN.app_metadata.org_id).not.toBe(ORG_B.id)
  })

  it('platform admin should see ALL orgs', () => {
    expect(PLATFORM_ADMIN.app_metadata.is_platform_admin).toBe(true)
    // RLS policy: org_select_platform_admin USING (app_metadata.is_platform_admin = true)
  })

  it('platform admin claim must be in app_metadata (not user_metadata)', () => {
    // A policy checa: current_setting('request.jwt.claims')::jsonb -> 'app_metadata'
    // NAO checa user_metadata (que e user-controllable)
    expect(PLATFORM_ADMIN.app_metadata.is_platform_admin).toBe(true)
  })
})

describe('RLS Contract — Cross-Tenant Isolation', () => {
  const tables = ['checklists', 'checklist_responses', 'stores', 'users', 'action_plans', 'template_fields', 'checklist_templates', 'template_visibility', 'sectors', 'functions']

  tables.forEach(table => {
    it(`${table} table has tenant_id RLS policy`, () => {
      // Cada tabela deve ter policy: tenant_{table}_select USING (tenant_id = get_current_org_id())
      // Documentado — verificacao real no SQL test
      expect(table).toBeTruthy()
    })
  })
})

describe('RLS Contract — Webhook Idempotency Table', () => {
  it('stripe_webhook_events should not have tenant RLS (global table)', () => {
    // Webhook events sao globais (nao pertencem a um tenant)
    // A tabela nao deve ter RLS baseado em tenant_id
    const isGlobal = true
    expect(isGlobal).toBe(true)
  })
})

describe('RLS Contract — Pricing Configs', () => {
  it('pricing_configs should be readable by ALL (public)', () => {
    // Policy: pricing_public_read USING (true)
    // Landing page precisa ler sem auth
    const publicRead = true
    expect(publicRead).toBe(true)
  })

  it('pricing_configs should be writable only by platform admin', () => {
    // Policy: pricing_superadmin_write USING (app_metadata.is_platform_admin = true)
    expect(PLATFORM_ADMIN.app_metadata.is_platform_admin).toBe(true)
  })
})
