// ============================================
// Testes: stripe utils (getPlanFromPriceId, getFeaturesForPlan)
// ============================================

import { describe, it, expect } from 'vitest'
import { getPlanFromPriceId, getFeaturesForPlan } from '../stripe'
import { PLAN_CONFIGS } from '@/types/tenant'

describe('getPlanFromPriceId', () => {
  it('retorna "starter" para o priceId do starter', () => {
    const priceId = PLAN_CONFIGS.starter.stripePriceId
    if (priceId) {
      expect(getPlanFromPriceId(priceId)).toBe('starter')
    }
  })

  it('retorna "professional" para o priceId do professional', () => {
    const priceId = PLAN_CONFIGS.professional.stripePriceId
    if (priceId) {
      expect(getPlanFromPriceId(priceId)).toBe('professional')
    }
  })

  it('retorna "enterprise" para o priceId do enterprise', () => {
    const priceId = PLAN_CONFIGS.enterprise.stripePriceId
    if (priceId) {
      expect(getPlanFromPriceId(priceId)).toBe('enterprise')
    }
  })

  it('retorna null para priceId desconhecido', () => {
    expect(getPlanFromPriceId('price_inexistente_123')).toBeNull()
  })

  it('retorna "trial" para string vazia (trial tem stripePriceId vazio)', () => {
    expect(getPlanFromPriceId('')).toBe('trial')
  })

  it('cada plano pago tem um priceId unico', () => {
    const priceIds = new Set<string>()
    for (const [plan, config] of Object.entries(PLAN_CONFIGS)) {
      if (plan === 'trial') continue
      if (config.stripePriceId) {
        expect(priceIds.has(config.stripePriceId)).toBe(false)
        priceIds.add(config.stripePriceId)
      }
    }
  })
})

describe('getFeaturesForPlan', () => {
  it('retorna features do trial', () => {
    const features = getFeaturesForPlan('trial')
    expect(features).toEqual(PLAN_CONFIGS.trial.features)
    expect(features.length).toBeGreaterThan(0)
  })

  it('retorna features do starter', () => {
    const features = getFeaturesForPlan('starter')
    expect(features).toEqual(PLAN_CONFIGS.starter.features)
  })

  it('retorna features do professional', () => {
    const features = getFeaturesForPlan('professional')
    expect(features).toEqual(PLAN_CONFIGS.professional.features)
    // Professional tem mais features que starter
    expect(features.length).toBeGreaterThan(PLAN_CONFIGS.starter.features.length)
  })

  it('retorna features do enterprise', () => {
    const features = getFeaturesForPlan('enterprise')
    expect(features).toEqual(PLAN_CONFIGS.enterprise.features)
    // Enterprise tem mais features que professional
    expect(features.length).toBeGreaterThanOrEqual(PLAN_CONFIGS.professional.features.length)
  })

  it('retorna features do trial como fallback para plano inexistente', () => {
    const features = getFeaturesForPlan('plano_que_nao_existe')
    expect(features).toEqual(PLAN_CONFIGS.trial.features)
  })

  it('enterprise inclui todas as features dos planos inferiores', () => {
    const enterprise = getFeaturesForPlan('enterprise')
    const professional = getFeaturesForPlan('professional')
    const starter = getFeaturesForPlan('starter')

    for (const feature of starter) {
      expect(enterprise).toContain(feature)
    }
    for (const feature of professional) {
      expect(enterprise).toContain(feature)
    }
  })

  it('professional inclui todas as features do starter', () => {
    const professional = getFeaturesForPlan('professional')
    const starter = getFeaturesForPlan('starter')

    for (const feature of starter) {
      expect(professional).toContain(feature)
    }
  })
})
