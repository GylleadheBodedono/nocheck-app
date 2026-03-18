/* eslint-disable */
// eslint-disable @typescript-eslint/no-unused-vars, react/display-name
// ============================================
// Testes — useFeature
// ============================================
// Valida que feature flags funcionam corretamente
// baseado no plano da organizacao.
// ============================================

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement } from 'react'
import { TenantCtx } from '@/hooks/useTenant'
import { useFeature } from '@/hooks/useFeature'
import { PLAN_CONFIGS, type TenantContext, type Feature } from '@/types/tenant'

// Helper: cria wrapper com features especificas
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

describe('useFeature', () => {
  // --- hasFeature ---

  describe('hasFeature', () => {
    it('plano trial tem apenas basic_orders e basic_reports', () => {
      const features = PLAN_CONFIGS.trial.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasFeature('basic_orders')).toBe(true)
      expect(result.current.hasFeature('basic_reports')).toBe(true)
      expect(result.current.hasFeature('export_excel')).toBe(false)
      expect(result.current.hasFeature('api_access')).toBe(false)
      expect(result.current.hasFeature('white_label')).toBe(false)
    })

    it('plano starter adiciona cancellations e kpi_dashboard', () => {
      const features = PLAN_CONFIGS.starter.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasFeature('basic_orders')).toBe(true)
      expect(result.current.hasFeature('cancellations')).toBe(true)
      expect(result.current.hasFeature('kpi_dashboard')).toBe(true)
      expect(result.current.hasFeature('bi_dashboard')).toBe(false)
      expect(result.current.hasFeature('export_excel')).toBe(false)
    })

    it('plano professional adiciona exports e integracoes', () => {
      const features = PLAN_CONFIGS.professional.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasFeature('export_excel')).toBe(true)
      expect(result.current.hasFeature('export_pdf')).toBe(true)
      expect(result.current.hasFeature('integrations_ifood')).toBe(true)
      expect(result.current.hasFeature('integrations_teknisa')).toBe(true)
      expect(result.current.hasFeature('white_label')).toBe(false)
      expect(result.current.hasFeature('api_access')).toBe(false)
    })

    it('plano enterprise tem TODAS as features', () => {
      const features = PLAN_CONFIGS.enterprise.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasFeature('basic_orders')).toBe(true)
      expect(result.current.hasFeature('white_label')).toBe(true)
      expect(result.current.hasFeature('api_access')).toBe(true)
      expect(result.current.hasFeature('custom_domain')).toBe(true)
      expect(result.current.hasFeature('audit_logs')).toBe(true)
      expect(result.current.hasFeature('advanced_analytics')).toBe(true)
    })

    it('sem features = tudo false', () => {
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features: [] }),
      })

      expect(result.current.hasFeature('basic_orders')).toBe(false)
    })
  })

  // --- Superadmin ---

  describe('isPlatformAdmin', () => {
    it('superadmin tem TODAS as features mesmo sem plano', () => {
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ isPlatformAdmin: true, features: [] }),
      })

      expect(result.current.hasFeature('api_access')).toBe(true)
      expect(result.current.hasFeature('white_label')).toBe(true)
      expect(result.current.hasFeature('advanced_analytics')).toBe(true)
    })
  })

  // --- hasAllFeatures ---

  describe('hasAllFeatures', () => {
    it('retorna true se TODAS as features estao presentes', () => {
      const features = PLAN_CONFIGS.enterprise.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasAllFeatures(['basic_orders', 'white_label', 'api_access'])).toBe(true)
    })

    it('retorna false se UMA feature esta ausente', () => {
      const features = PLAN_CONFIGS.starter.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasAllFeatures(['basic_orders', 'white_label'])).toBe(false)
    })
  })

  // --- hasAnyFeature ---

  describe('hasAnyFeature', () => {
    it('retorna true se PELO MENOS UMA feature esta presente', () => {
      const features = PLAN_CONFIGS.trial.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasAnyFeature(['white_label', 'basic_orders'])).toBe(true)
    })

    it('retorna false se NENHUMA feature esta presente', () => {
      const features = PLAN_CONFIGS.trial.features
      const { result } = renderHook(() => useFeature(), {
        wrapper: createWrapper({ features }),
      })

      expect(result.current.hasAnyFeature(['white_label', 'api_access'])).toBe(false)
    })
  })
})
