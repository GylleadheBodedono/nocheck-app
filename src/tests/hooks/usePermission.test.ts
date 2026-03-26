/* eslint-disable */
// eslint-disable @typescript-eslint/no-unused-vars, react/display-name
// ============================================
// Testes — usePermission
// ============================================
// Valida a hierarquia de roles e permissoes:
//   owner > admin > manager > member > viewer
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { TenantCtx } from '@/hooks/useTenant'
import { usePermission } from '@/hooks/usePermission'
import type { TenantContext, Permission } from '@/types/tenant'

// Helper: cria wrapper com TenantContext customizado
function createWrapper(overrides: Partial<TenantContext> = {}) {
  const defaultCtx: TenantContext = {
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
    createElement(TenantCtx.Provider, { value: defaultCtx }, children)
}

describe('usePermission', () => {
  // --- Hierarquia de roles ---

  describe('hasPermission', () => {
    it('owner tem TODAS as permissoes', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'owner' }),
      })

      const allPerms: Permission[] = [
        'manage_billing', 'manage_members', 'manage_stores',
        'manage_templates', 'view_reports', 'fill_checklists', 'view_checklists',
      ]

      allPerms.forEach(perm => {
        expect(result.current.hasPermission(perm)).toBe(true)
      })
    })

    it('admin tem tudo EXCETO manage_billing', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'admin' }),
      })

      expect(result.current.hasPermission('manage_billing')).toBe(false)
      expect(result.current.hasPermission('manage_members')).toBe(true)
      expect(result.current.hasPermission('manage_stores')).toBe(true)
      expect(result.current.hasPermission('manage_templates')).toBe(true)
      expect(result.current.hasPermission('view_reports')).toBe(true)
      expect(result.current.hasPermission('fill_checklists')).toBe(true)
    })

    it('manager pode gerenciar templates e ver relatorios, mas nao membros', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'manager' }),
      })

      expect(result.current.hasPermission('manage_members')).toBe(false)
      expect(result.current.hasPermission('manage_stores')).toBe(false)
      expect(result.current.hasPermission('manage_templates')).toBe(true)
      expect(result.current.hasPermission('view_reports')).toBe(true)
      expect(result.current.hasPermission('fill_checklists')).toBe(true)
    })

    it('member so pode preencher e ver checklists', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'member' }),
      })

      expect(result.current.hasPermission('manage_members')).toBe(false)
      expect(result.current.hasPermission('manage_templates')).toBe(false)
      expect(result.current.hasPermission('view_reports')).toBe(false)
      expect(result.current.hasPermission('fill_checklists')).toBe(true)
      expect(result.current.hasPermission('view_checklists')).toBe(true)
    })

    it('viewer so pode visualizar checklists', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'viewer' }),
      })

      expect(result.current.hasPermission('fill_checklists')).toBe(false)
      expect(result.current.hasPermission('view_checklists')).toBe(true)
      expect(result.current.hasPermission('manage_billing')).toBe(false)
    })

    it('sem role = sem permissao nenhuma', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: null }),
      })

      expect(result.current.hasPermission('view_checklists')).toBe(false)
      expect(result.current.hasPermission('fill_checklists')).toBe(false)
    })
  })

  // --- Superadmin bypassa tudo ---

  describe('isPlatformAdmin', () => {
    it('superadmin tem TODAS as permissoes independente do role', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ isPlatformAdmin: true, currentRole: null }),
      })

      expect(result.current.hasPermission('manage_billing')).toBe(true)
      expect(result.current.hasPermission('manage_members')).toBe(true)
      expect(result.current.hasPermission('view_checklists')).toBe(true)
    })

    it('superadmin com role viewer ainda tem tudo', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ isPlatformAdmin: true, currentRole: 'viewer' }),
      })

      expect(result.current.hasPermission('manage_billing')).toBe(true)
    })
  })

  // --- hasMinRole ---

  describe('hasMinRole', () => {
    it('owner >= qualquer role', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'owner' }),
      })

      expect(result.current.hasMinRole('owner')).toBe(true)
      expect(result.current.hasMinRole('admin')).toBe(true)
      expect(result.current.hasMinRole('member')).toBe(true)
      expect(result.current.hasMinRole('viewer')).toBe(true)
    })

    it('member NAO e >= admin', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: 'member' }),
      })

      expect(result.current.hasMinRole('admin')).toBe(false)
      expect(result.current.hasMinRole('manager')).toBe(false)
      expect(result.current.hasMinRole('member')).toBe(true)
      expect(result.current.hasMinRole('viewer')).toBe(true)
    })

    it('sem role = false para tudo', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ currentRole: null }),
      })

      expect(result.current.hasMinRole('viewer')).toBe(false)
    })

    it('superadmin >= qualquer role mesmo sem role definido', () => {
      const { result } = renderHook(() => usePermission(), {
        wrapper: createWrapper({ isPlatformAdmin: true, currentRole: null }),
      })

      expect(result.current.hasMinRole('owner')).toBe(true)
    })
  })
})
