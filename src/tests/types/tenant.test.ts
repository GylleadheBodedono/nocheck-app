/* eslint-disable */
// eslint-disable @typescript-eslint/no-unused-vars, react/display-name
// ============================================
// Testes — Tipos e configuracoes de plano
// ============================================
// Valida que os PLAN_CONFIGS e ROLE_HIERARCHY
// estao consistentes e corretos.
// ============================================

import { describe, it, expect } from 'vitest'
import { PLAN_CONFIGS, ROLE_HIERARCHY } from '@/types/tenant'

describe('PLAN_CONFIGS', () => {
  it('trial e gratis', () => {
    expect(PLAN_CONFIGS.trial.price).toBe(0)
  })

  it('cada plano superior tem mais features que o anterior', () => {
    const trialCount = PLAN_CONFIGS.trial.features.length
    const starterCount = PLAN_CONFIGS.starter.features.length
    const proCount = PLAN_CONFIGS.professional.features.length
    const entCount = PLAN_CONFIGS.enterprise.features.length

    expect(starterCount).toBeGreaterThan(trialCount)
    expect(proCount).toBeGreaterThan(starterCount)
    expect(entCount).toBeGreaterThan(proCount)
  })

  it('cada plano superior tem mais usuarios permitidos', () => {
    expect(PLAN_CONFIGS.starter.maxUsers).toBeGreaterThan(PLAN_CONFIGS.trial.maxUsers)
    expect(PLAN_CONFIGS.professional.maxUsers).toBeGreaterThan(PLAN_CONFIGS.starter.maxUsers)
    expect(PLAN_CONFIGS.enterprise.maxUsers).toBeGreaterThan(PLAN_CONFIGS.professional.maxUsers)
  })

  it('cada plano superior tem mais lojas permitidas', () => {
    expect(PLAN_CONFIGS.starter.maxStores).toBeGreaterThan(PLAN_CONFIGS.trial.maxStores)
    expect(PLAN_CONFIGS.professional.maxStores).toBeGreaterThan(PLAN_CONFIGS.starter.maxStores)
    expect(PLAN_CONFIGS.enterprise.maxStores).toBeGreaterThan(PLAN_CONFIGS.professional.maxStores)
  })

  it('enterprise tem api_access e white_label', () => {
    expect(PLAN_CONFIGS.enterprise.features).toContain('api_access')
    expect(PLAN_CONFIGS.enterprise.features).toContain('white_label')
    expect(PLAN_CONFIGS.enterprise.features).toContain('custom_domain')
  })

  it('trial NAO tem features avancadas', () => {
    expect(PLAN_CONFIGS.trial.features).not.toContain('export_excel')
    expect(PLAN_CONFIGS.trial.features).not.toContain('api_access')
    expect(PLAN_CONFIGS.trial.features).not.toContain('white_label')
  })

  it('todos os planos tem basic_orders e basic_reports', () => {
    Object.values(PLAN_CONFIGS).forEach(plan => {
      expect(plan.features).toContain('basic_orders')
      expect(plan.features).toContain('basic_reports')
    })
  })

  it('precos crescem com o plano', () => {
    expect(PLAN_CONFIGS.trial.price).toBe(0)
    expect(PLAN_CONFIGS.starter.price).toBeLessThan(PLAN_CONFIGS.professional.price)
    expect(PLAN_CONFIGS.professional.price).toBeLessThan(PLAN_CONFIGS.enterprise.price)
  })
})

describe('ROLE_HIERARCHY', () => {
  it('owner tem manage_billing', () => {
    expect(ROLE_HIERARCHY.owner).toContain('manage_billing')
  })

  it('admin NAO tem manage_billing', () => {
    expect(ROLE_HIERARCHY.admin).not.toContain('manage_billing')
  })

  it('viewer so tem view_checklists', () => {
    expect(ROLE_HIERARCHY.viewer).toEqual(['view_checklists'])
  })

  it('cada role superior tem todas as permissoes do inferior', () => {
    const viewerPerms = ROLE_HIERARCHY.viewer
    const memberPerms = ROLE_HIERARCHY.member
    const managerPerms = ROLE_HIERARCHY.manager
    const adminPerms = ROLE_HIERARCHY.admin
    const ownerPerms = ROLE_HIERARCHY.owner

    // member inclui tudo do viewer
    viewerPerms.forEach(p => expect(memberPerms).toContain(p))
    // manager inclui tudo do member
    memberPerms.forEach(p => expect(managerPerms).toContain(p))
    // admin inclui tudo do manager
    managerPerms.forEach(p => expect(adminPerms).toContain(p))
    // owner inclui tudo do admin
    adminPerms.forEach(p => expect(ownerPerms).toContain(p))
  })

  it('5 roles definidos', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(5)
    expect(Object.keys(ROLE_HIERARCHY)).toEqual(['owner', 'admin', 'manager', 'member', 'viewer'])
  })
})
