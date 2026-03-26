// ============================================
// useFeature — Verificacao de feature flags por plano
// ============================================
// Cada plano (trial, starter, professional, enterprise)
// tem um conjunto de features habilitadas.
// Este hook verifica se a org atual tem acesso a uma feature.
//
// Uso:
//   const { hasFeature } = useFeature()
//   if (hasFeature('export_excel')) { ... }
//
// As features sao injetadas no JWT pelo custom_access_token_hook
// e ficam disponiveis via TenantContext.
// ============================================

'use client'

import { useCallback } from 'react'
import { useTenant } from './useTenant'
import type { Feature } from '@/types/tenant'

export function useFeature() {
  const { features, isPlatformAdmin } = useTenant()

  /**
   * Verifica se a feature esta disponivel no plano atual.
   * Superadmin tem acesso a TODAS as features.
   */
  const hasFeature = useCallback(
    (feature: Feature): boolean => {
      if (isPlatformAdmin) return true
      return features.includes(feature)
    },
    [features, isPlatformAdmin]
  )

  /**
   * Verifica se TODAS as features listadas estao disponiveis.
   */
  const hasAllFeatures = useCallback(
    (requiredFeatures: Feature[]): boolean => {
      if (isPlatformAdmin) return true
      return requiredFeatures.every((f) => features.includes(f))
    },
    [features, isPlatformAdmin]
  )

  /**
   * Verifica se PELO MENOS UMA das features listadas esta disponivel.
   */
  const hasAnyFeature = useCallback(
    (requiredFeatures: Feature[]): boolean => {
      if (isPlatformAdmin) return true
      return requiredFeatures.some((f) => features.includes(f))
    },
    [features, isPlatformAdmin]
  )

  return { hasFeature, hasAllFeatures, hasAnyFeature, features }
}
