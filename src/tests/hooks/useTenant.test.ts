/* eslint-disable */
// eslint-disable @typescript-eslint/no-unused-vars, react/display-name
// ============================================
// Testes — useTenant
// ============================================
// Valida o contexto do tenant e as flags de acesso
// para os 3 niveis de usuario:
//   Superadmin, Admin, Funcionario
// ============================================

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { TenantCtx, useTenant } from '@/hooks/useTenant'
import type { TenantContext, Organization } from '@/types/tenant'

// Helper: org fake para testes
const fakeOrg: Organization = {
  id: 'org-123',
  name: 'Restaurante Teste',
  slug: 'restaurante-teste',
  plan: 'professional',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  settings: {
    theme: { primaryColor: '#264653', logoUrl: null, faviconUrl: null, appName: 'Teste' },
    customDomain: null,
    emailFrom: null,
  },
  max_users: 15,
  max_stores: 10,
  features: ['basic_orders', 'basic_reports', 'export_excel'],
  is_active: true,
  trial_ends_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// Helper: cria wrapper com TenantContext
function createWrapper(overrides: Partial<TenantContext> = {}) {
  const ctx: TenantContext = {
    organization: null,
    currentRole: null,
    features: [],
    isPlatformAdmin: false,
    isOwner: false,
    isOrgAdmin: false,
    isManager: false,
    orgSlug: null,
    isLoading: false,
    ...overrides,
  }

  return ({ children }: { children: React.ReactNode }) =>
    createElement(TenantCtx.Provider, { value: ctx }, children)
}

describe('useTenant', () => {
  // --- Contexto padrao (sem provider) ---

  describe('contexto padrao', () => {
    it('retorna isLoading=true sem provider (contexto default)', () => {
      const { result } = renderHook(() => useTenant())
      expect(result.current.isLoading).toBe(true)
      expect(result.current.organization).toBeNull()
      expect(result.current.isPlatformAdmin).toBe(false)
    })
  })

  // --- Superadmin ---

  describe('Superadmin (dono da plataforma)', () => {
    it('isPlatformAdmin=true, pode nao ter org', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          isPlatformAdmin: true,
          currentRole: null,
          organization: null,
        }),
      })

      expect(result.current.isPlatformAdmin).toBe(true)
      expect(result.current.organization).toBeNull()
      expect(result.current.isOrgAdmin).toBe(false) // nao faz parte de org
    })

    it('isPlatformAdmin=true com org retorna dados da org', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          isPlatformAdmin: true,
          currentRole: 'owner',
          organization: fakeOrg,
          isOwner: true,
          isOrgAdmin: true,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isPlatformAdmin).toBe(true)
      expect(result.current.organization?.name).toBe('Restaurante Teste')
      expect(result.current.isOwner).toBe(true)
    })
  })

  // --- Admin (dono do restaurante) ---

  describe('Admin (dono do restaurante)', () => {
    it('owner tem isOwner=true e isOrgAdmin=true', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          currentRole: 'owner',
          organization: fakeOrg,
          isOwner: true,
          isOrgAdmin: true,
          isManager: true,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isOwner).toBe(true)
      expect(result.current.isOrgAdmin).toBe(true)
      expect(result.current.isManager).toBe(true)
      expect(result.current.isPlatformAdmin).toBe(false)
      expect(result.current.currentRole).toBe('owner')
    })

    it('admin tem isOrgAdmin=true mas isOwner=false', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          currentRole: 'admin',
          organization: fakeOrg,
          isOwner: false,
          isOrgAdmin: true,
          isManager: true,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isOwner).toBe(false)
      expect(result.current.isOrgAdmin).toBe(true)
      expect(result.current.isManager).toBe(true)
    })
  })

  // --- Funcionario ---

  describe('Funcionario (empregado)', () => {
    it('member nao e admin nem manager', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          currentRole: 'member',
          organization: fakeOrg,
          isOwner: false,
          isOrgAdmin: false,
          isManager: false,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isOrgAdmin).toBe(false)
      expect(result.current.isManager).toBe(false)
      expect(result.current.currentRole).toBe('member')
      expect(result.current.organization?.name).toBe('Restaurante Teste')
    })

    it('viewer nao pode fazer nada alem de ver', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          currentRole: 'viewer',
          organization: fakeOrg,
          isOwner: false,
          isOrgAdmin: false,
          isManager: false,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isOrgAdmin).toBe(false)
      expect(result.current.isManager).toBe(false)
      expect(result.current.currentRole).toBe('viewer')
    })

    it('manager e isManager=true mas nao isOrgAdmin', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          currentRole: 'manager',
          organization: fakeOrg,
          isOwner: false,
          isOrgAdmin: false,
          isManager: true,
          orgSlug: 'restaurante-teste',
        }),
      })

      expect(result.current.isManager).toBe(true)
      expect(result.current.isOrgAdmin).toBe(false)
    })
  })

  // --- Features e plano ---

  describe('features da organizacao', () => {
    it('retorna features do plano corretamente', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({
          features: ['basic_orders', 'basic_reports', 'export_excel'],
          organization: fakeOrg,
        }),
      })

      expect(result.current.features).toContain('basic_orders')
      expect(result.current.features).toContain('export_excel')
      expect(result.current.features).not.toContain('white_label')
    })

    it('retorna features vazio se nao tem org', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({ features: [] }),
      })

      expect(result.current.features).toEqual([])
    })
  })

  // --- orgSlug ---

  describe('orgSlug', () => {
    it('retorna o slug da org', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({ orgSlug: 'grupo-do-no' }),
      })

      expect(result.current.orgSlug).toBe('grupo-do-no')
    })

    it('retorna null se nao tem org', () => {
      const { result } = renderHook(() => useTenant(), {
        wrapper: createWrapper({ orgSlug: null }),
      })

      expect(result.current.orgSlug).toBeNull()
    })
  })
})
