// ============================================
// Testes — Plan Limits (limites de cada plano)
// ============================================
// Testa a verificacao de limites de usuarios e lojas
// para cada plano: trial, starter, professional, enterprise.
// ============================================

import { describe, it, expect } from 'vitest'
import { checkUserLimit, checkStoreLimit, getLimitMessage } from '@/lib/planLimits'
import { PLAN_CONFIGS, type Plan } from '@/types/tenant'

// ─── Limites de Usuarios ───

describe('checkUserLimit', () => {
  describe('Trial (max 3 usuarios)', () => {
    it('permite quando abaixo do limite', () => {
      const result = checkUserLimit(0, 'trial')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(3)
    })

    it('permite com 2 usuarios (abaixo de 3)', () => {
      const result = checkUserLimit(2, 'trial')
      expect(result.allowed).toBe(true)
      expect(result.current).toBe(2)
    })

    it('bloqueia ao atingir o limite de 3', () => {
      const result = checkUserLimit(3, 'trial')
      expect(result.allowed).toBe(false)
      expect(result.current).toBe(3)
      expect(result.max).toBe(3)
    })

    it('bloqueia acima do limite', () => {
      const result = checkUserLimit(5, 'trial')
      expect(result.allowed).toBe(false)
    })
  })

  describe('Starter (max 5 usuarios)', () => {
    it('permite com 4 usuarios', () => {
      const result = checkUserLimit(4, 'starter')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(5)
    })

    it('bloqueia ao atingir 5', () => {
      const result = checkUserLimit(5, 'starter')
      expect(result.allowed).toBe(false)
    })
  })

  describe('Professional (max 15 usuarios)', () => {
    it('permite com 14 usuarios', () => {
      const result = checkUserLimit(14, 'professional')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(15)
    })

    it('bloqueia ao atingir 15', () => {
      const result = checkUserLimit(15, 'professional')
      expect(result.allowed).toBe(false)
    })
  })

  describe('Enterprise (max 999 usuarios)', () => {
    it('permite com 100 usuarios', () => {
      const result = checkUserLimit(100, 'enterprise')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(999)
    })

    it('permite com 998 usuarios', () => {
      const result = checkUserLimit(998, 'enterprise')
      expect(result.allowed).toBe(true)
    })

    it('bloqueia ao atingir 999', () => {
      const result = checkUserLimit(999, 'enterprise')
      expect(result.allowed).toBe(false)
    })
  })

  it('aceita override de maxUsers', () => {
    // Org com limit custom (ex: negociado)
    const result = checkUserLimit(9, 'starter', 10)
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(10)
  })

  it('bloqueia com override de maxUsers atingido', () => {
    const result = checkUserLimit(10, 'starter', 10)
    expect(result.allowed).toBe(false)
    expect(result.max).toBe(10)
  })

  it('retorna plan correto no resultado', () => {
    const result = checkUserLimit(0, 'professional')
    expect(result.plan).toBe('professional')
  })

  it('fallback para trial se plan invalido', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = checkUserLimit(0, 'invalid_plan' as any)
    expect(result.max).toBe(PLAN_CONFIGS.trial.maxUsers)
  })
})

// ─── Limites de Lojas ───

describe('checkStoreLimit', () => {
  describe('Trial (max 1 loja)', () => {
    it('permite quando zero lojas', () => {
      const result = checkStoreLimit(0, 'trial')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(1)
    })

    it('bloqueia ao atingir 1 loja', () => {
      const result = checkStoreLimit(1, 'trial')
      expect(result.allowed).toBe(false)
      expect(result.current).toBe(1)
      expect(result.max).toBe(1)
    })
  })

  describe('Starter (max 3 lojas)', () => {
    it('permite com 2 lojas', () => {
      const result = checkStoreLimit(2, 'starter')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(3)
    })

    it('bloqueia ao atingir 3', () => {
      const result = checkStoreLimit(3, 'starter')
      expect(result.allowed).toBe(false)
    })
  })

  describe('Professional (max 10 lojas)', () => {
    it('permite com 9 lojas', () => {
      const result = checkStoreLimit(9, 'professional')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(10)
    })

    it('bloqueia ao atingir 10', () => {
      const result = checkStoreLimit(10, 'professional')
      expect(result.allowed).toBe(false)
    })
  })

  describe('Enterprise (max 999 lojas)', () => {
    it('permite com 500 lojas', () => {
      const result = checkStoreLimit(500, 'enterprise')
      expect(result.allowed).toBe(true)
      expect(result.max).toBe(999)
    })

    it('bloqueia ao atingir 999', () => {
      const result = checkStoreLimit(999, 'enterprise')
      expect(result.allowed).toBe(false)
    })
  })

  it('aceita override de maxStores', () => {
    const result = checkStoreLimit(4, 'starter', 5)
    expect(result.allowed).toBe(true)
    expect(result.max).toBe(5)
  })
})

// ─── Mensagens de Limite ───

describe('getLimitMessage', () => {
  it('mensagem de usuarios correta', () => {
    const check = checkUserLimit(3, 'trial')
    const msg = getLimitMessage('users', check)
    expect(msg).toContain('usuários')
    expect(msg).toContain('3/3')
    expect(msg).toContain('trial')
    expect(msg).toContain('upgrade')
  })

  it('mensagem de lojas correta', () => {
    const check = checkStoreLimit(1, 'trial')
    const msg = getLimitMessage('stores', check)
    expect(msg).toContain('lojas')
    expect(msg).toContain('1/1')
    expect(msg).toContain('trial')
  })

  it('mensagem inclui nome do plano starter', () => {
    const check = checkStoreLimit(3, 'starter')
    const msg = getLimitMessage('stores', check)
    expect(msg).toContain('starter')
  })
})

// ─── Validacao cruzada com PLAN_CONFIGS ───

describe('Limites consistentes com PLAN_CONFIGS', () => {
  const plans: Plan[] = ['trial', 'starter', 'professional', 'enterprise']

  plans.forEach(plan => {
    const config = PLAN_CONFIGS[plan]

    it(`${plan}: checkUserLimit usa maxUsers=${config.maxUsers}`, () => {
      // No limite → bloqueado
      const atLimit = checkUserLimit(config.maxUsers, plan)
      expect(atLimit.allowed).toBe(false)
      expect(atLimit.max).toBe(config.maxUsers)

      // Abaixo do limite → permitido
      if (config.maxUsers > 0) {
        const belowLimit = checkUserLimit(config.maxUsers - 1, plan)
        expect(belowLimit.allowed).toBe(true)
      }
    })

    it(`${plan}: checkStoreLimit usa maxStores=${config.maxStores}`, () => {
      const atLimit = checkStoreLimit(config.maxStores, plan)
      expect(atLimit.allowed).toBe(false)
      expect(atLimit.max).toBe(config.maxStores)

      if (config.maxStores > 0) {
        const belowLimit = checkStoreLimit(config.maxStores - 1, plan)
        expect(belowLimit.allowed).toBe(true)
      }
    })
  })

  it('limites crescem com upgrade de plano', () => {
    for (let i = 1; i < plans.length; i++) {
      const prev = PLAN_CONFIGS[plans[i - 1]]
      const curr = PLAN_CONFIGS[plans[i]]
      expect(curr.maxUsers).toBeGreaterThanOrEqual(prev.maxUsers)
      expect(curr.maxStores).toBeGreaterThanOrEqual(prev.maxStores)
    }
  })
})

// ─── Feature flags por plano ───

describe('Features por plano', () => {
  it('trial tem apenas basic_orders e basic_reports', () => {
    expect(PLAN_CONFIGS.trial.features).toEqual(['basic_orders', 'basic_reports'])
  })

  it('starter adiciona cancellations e kpi_dashboard', () => {
    const { features } = PLAN_CONFIGS.starter
    expect(features).toContain('cancellations')
    expect(features).toContain('kpi_dashboard')
    expect(features).not.toContain('export_excel')
    expect(features).not.toContain('white_label')
  })

  it('professional adiciona exports e integracoes', () => {
    const { features } = PLAN_CONFIGS.professional
    expect(features).toContain('export_excel')
    expect(features).toContain('export_pdf')
    expect(features).toContain('integrations_ifood')
    expect(features).toContain('integrations_teknisa')
    expect(features).toContain('bi_dashboard')
    expect(features).not.toContain('white_label')
    expect(features).not.toContain('api_access')
  })

  it('enterprise tem TODAS as features', () => {
    const { features } = PLAN_CONFIGS.enterprise
    expect(features).toContain('white_label')
    expect(features).toContain('api_access')
    expect(features).toContain('custom_domain')
    expect(features).toContain('audit_logs')
    expect(features).toContain('advanced_analytics')
    // Tambem tem as de planos inferiores
    expect(features).toContain('basic_orders')
    expect(features).toContain('export_excel')
    expect(features).toContain('integrations_ifood')
  })

  it('cada plano inclui todas as features do anterior', () => {
    const plans: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    for (let i = 1; i < plans.length; i++) {
      const prevFeatures = PLAN_CONFIGS[plans[i - 1]].features
      const currFeatures = PLAN_CONFIGS[plans[i]].features
      prevFeatures.forEach(f => {
        expect(currFeatures).toContain(f)
      })
    }
  })
})

// ─── Precos e hierarquia ───

describe('Precos e hierarquia dos planos', () => {
  it('trial e gratuito', () => {
    expect(PLAN_CONFIGS.trial.price).toBe(0)
    expect(PLAN_CONFIGS.trial.stripePriceId).toBe('')
  })

  it('precos crescem: trial < starter < professional < enterprise', () => {
    expect(PLAN_CONFIGS.trial.price).toBeLessThan(PLAN_CONFIGS.starter.price)
    expect(PLAN_CONFIGS.starter.price).toBeLessThan(PLAN_CONFIGS.professional.price)
    expect(PLAN_CONFIGS.professional.price).toBeLessThan(PLAN_CONFIGS.enterprise.price)
  })

  it('planos pagos tem stripePriceId', () => {
    expect(PLAN_CONFIGS.starter.stripePriceId).toBeTruthy()
    expect(PLAN_CONFIGS.professional.stripePriceId).toBeTruthy()
    expect(PLAN_CONFIGS.enterprise.stripePriceId).toBeTruthy()
  })

  it('valores especificos de preco', () => {
    expect(PLAN_CONFIGS.starter.price).toBe(297)
    expect(PLAN_CONFIGS.professional.price).toBe(597)
    expect(PLAN_CONFIGS.enterprise.price).toBe(997)
  })

  it('limites especificos por plano', () => {
    expect(PLAN_CONFIGS.trial.maxUsers).toBe(3)
    expect(PLAN_CONFIGS.trial.maxStores).toBe(1)

    expect(PLAN_CONFIGS.starter.maxUsers).toBe(5)
    expect(PLAN_CONFIGS.starter.maxStores).toBe(3)

    expect(PLAN_CONFIGS.professional.maxUsers).toBe(15)
    expect(PLAN_CONFIGS.professional.maxStores).toBe(10)

    expect(PLAN_CONFIGS.enterprise.maxUsers).toBe(999)
    expect(PLAN_CONFIGS.enterprise.maxStores).toBe(999)
  })
})

// ─── Boundary testing (edge cases) ───

describe('Edge cases', () => {
  it('zero usuarios/lojas sempre permite', () => {
    const plans: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    plans.forEach(plan => {
      expect(checkUserLimit(0, plan).allowed).toBe(true)
      expect(checkStoreLimit(0, plan).allowed).toBe(true)
    })
  })

  it('exatamente no limite bloqueia (>=, nao >)', () => {
    const plans: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    plans.forEach(plan => {
      const config = PLAN_CONFIGS[plan]
      expect(checkUserLimit(config.maxUsers, plan).allowed).toBe(false)
      expect(checkStoreLimit(config.maxStores, plan).allowed).toBe(false)
    })
  })

  it('um abaixo do limite permite', () => {
    const plans: Plan[] = ['trial', 'starter', 'professional', 'enterprise']
    plans.forEach(plan => {
      const config = PLAN_CONFIGS[plan]
      expect(checkUserLimit(config.maxUsers - 1, plan).allowed).toBe(true)
      expect(checkStoreLimit(config.maxStores - 1, plan).allowed).toBe(true)
    })
  })

  it('numeros negativos permitem (edge case)', () => {
    expect(checkUserLimit(-1, 'trial').allowed).toBe(true)
    expect(checkStoreLimit(-1, 'trial').allowed).toBe(true)
  })
})
