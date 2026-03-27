// ============================================
// Testes — Calculos de Adesao (adherenceCalculations)
// ============================================
// Valida as funcoes puras de calculo de adesao:
//   - computeStatusBreakdown
//   - computeAdherenceMetrics
//   - computeOverallAdherence
//   - formatMinutes
//   - generateEnhancedAttentionPoints
// ============================================

import { describe, it, expect } from 'vitest'
import {
  computeStatusBreakdown,
  computeAdherenceMetrics,
  computeOverallAdherence,
  formatMinutes,
  generateEnhancedAttentionPoints,
  type StatusBreakdown,
  type StoreAdherence,
  type CoverageGap,
} from '@/lib/adherenceCalculations'

// ─── computeStatusBreakdown ───

describe('computeStatusBreakdown', () => {
  it('conta cada status corretamente', () => {
    const checklists = [
      { status: 'rascunho' },
      { status: 'rascunho' },
      { status: 'em_andamento' },
      { status: 'concluido' },
      { status: 'concluido' },
      { status: 'concluido' },
      { status: 'validado' },
      { status: 'incompleto' },
    ]

    const result = computeStatusBreakdown(checklists)

    expect(result.rascunho).toBe(2)
    expect(result.em_andamento).toBe(1)
    expect(result.concluido).toBe(3)
    expect(result.validado).toBe(1)
    expect(result.incompleto).toBe(1)
    expect(result.total).toBe(8)
  })

  it('retorna zeros para array vazio', () => {
    const result = computeStatusBreakdown([])

    expect(result.rascunho).toBe(0)
    expect(result.em_andamento).toBe(0)
    expect(result.concluido).toBe(0)
    expect(result.validado).toBe(0)
    expect(result.incompleto).toBe(0)
    expect(result.total).toBe(0)
  })

  it('ignora status desconhecidos no total mas conta total', () => {
    const checklists = [
      { status: 'concluido' },
      { status: 'status_inventado' },
    ]

    const result = computeStatusBreakdown(checklists)

    expect(result.total).toBe(2)
    expect(result.concluido).toBe(1)
    // Status desconhecido nao incrementa nenhum campo
    expect(result.rascunho).toBe(0)
    expect(result.em_andamento).toBe(0)
    expect(result.validado).toBe(0)
    expect(result.incompleto).toBe(0)
  })

  it('conta todos como um unico status', () => {
    const checklists = Array.from({ length: 10 }, () => ({ status: 'validado' }))

    const result = computeStatusBreakdown(checklists)

    expect(result.validado).toBe(10)
    expect(result.total).toBe(10)
    expect(result.concluido).toBe(0)
  })
})

// ─── computeAdherenceMetrics ───

describe('computeAdherenceMetrics', () => {
  it('calcula porcentagens corretamente', () => {
    const breakdown: StatusBreakdown = {
      rascunho: 1,
      em_andamento: 2,
      concluido: 3,
      validado: 2,
      incompleto: 2,
      total: 10,
    }

    const result = computeAdherenceMetrics(breakdown)

    // completionRate = (concluido + validado) / total = 5/10 = 50%
    expect(result.completionRate).toBe(50)
    // inProgressRate = em_andamento / total = 2/10 = 20%
    expect(result.inProgressRate).toBe(20)
    // abandonRate = incompleto / total = 2/10 = 20%
    expect(result.abandonRate).toBe(20)
    // draftRate = rascunho / total = 1/10 = 10%
    expect(result.draftRate).toBe(10)
  })

  it('retorna 0% para tudo quando total e zero (usa 1 como divisor)', () => {
    const breakdown: StatusBreakdown = {
      rascunho: 0,
      em_andamento: 0,
      concluido: 0,
      validado: 0,
      incompleto: 0,
      total: 0,
    }

    const result = computeAdherenceMetrics(breakdown)

    expect(result.completionRate).toBe(0)
    expect(result.inProgressRate).toBe(0)
    expect(result.abandonRate).toBe(0)
    expect(result.draftRate).toBe(0)
  })

  it('arredonda porcentagens', () => {
    const breakdown: StatusBreakdown = {
      rascunho: 1,
      em_andamento: 1,
      concluido: 1,
      validado: 0,
      incompleto: 0,
      total: 3,
    }

    const result = computeAdherenceMetrics(breakdown)

    // completionRate = 1/3 = 33.33... → 33%
    expect(result.completionRate).toBe(33)
    // inProgressRate = 1/3 = 33.33... → 33%
    expect(result.inProgressRate).toBe(33)
    // draftRate = 1/3 = 33.33... → 33%
    expect(result.draftRate).toBe(33)
  })

  it('retorna 100% quando tudo esta concluido', () => {
    const breakdown: StatusBreakdown = {
      rascunho: 0,
      em_andamento: 0,
      concluido: 5,
      validado: 5,
      incompleto: 0,
      total: 10,
    }

    const result = computeAdherenceMetrics(breakdown)

    expect(result.completionRate).toBe(100)
    expect(result.abandonRate).toBe(0)
  })

  it('inclui statusBreakdown na resposta', () => {
    const breakdown: StatusBreakdown = {
      rascunho: 1,
      em_andamento: 0,
      concluido: 0,
      validado: 0,
      incompleto: 0,
      total: 1,
    }

    const result = computeAdherenceMetrics(breakdown)

    expect(result.statusBreakdown).toBe(breakdown)
  })
})

// ─── computeOverallAdherence ───

describe('computeOverallAdherence', () => {
  it('combina breakdown + metrics em uma chamada', () => {
    const checklists = [
      { status: 'concluido' },
      { status: 'concluido' },
      { status: 'em_andamento' },
      { status: 'rascunho' },
    ]

    const result = computeOverallAdherence(checklists)

    expect(result.completionRate).toBe(50) // 2/4
    expect(result.inProgressRate).toBe(25) // 1/4
    expect(result.draftRate).toBe(25) // 1/4
    expect(result.statusBreakdown.total).toBe(4)
  })

  it('retorna metricas zeradas para array vazio', () => {
    const result = computeOverallAdherence([])

    expect(result.completionRate).toBe(0)
    expect(result.inProgressRate).toBe(0)
    expect(result.abandonRate).toBe(0)
    expect(result.draftRate).toBe(0)
    expect(result.statusBreakdown.total).toBe(0)
  })
})

// ─── formatMinutes ───

describe('formatMinutes', () => {
  it('retorna "--" para null', () => {
    expect(formatMinutes(null)).toBe('--')
  })

  it('formata minutos menores que 60', () => {
    expect(formatMinutes(45)).toBe('45min')
  })

  it('formata minutos igual a 0', () => {
    expect(formatMinutes(0)).toBe('0min')
  })

  it('formata 1 minuto', () => {
    expect(formatMinutes(1)).toBe('1min')
  })

  it('formata 59 minutos', () => {
    expect(formatMinutes(59)).toBe('59min')
  })

  it('formata horas exatas sem minutos', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(180)).toBe('3h')
  })

  it('formata horas com minutos', () => {
    expect(formatMinutes(90)).toBe('1h 30min')
    expect(formatMinutes(150)).toBe('2h 30min')
    expect(formatMinutes(61)).toBe('1h 1min')
  })

  it('formata valores grandes', () => {
    expect(formatMinutes(1440)).toBe('24h')
    expect(formatMinutes(1441)).toBe('24h 1min')
  })
})

// ─── generateEnhancedAttentionPoints ───

describe('generateEnhancedAttentionPoints', () => {
  // Helpers para criar dados de teste
  function makeStoreAdherence(overrides: Partial<StoreAdherence> & { storeName: string; completionRate: number; em_andamento?: number; incompleto?: number }): StoreAdherence {
    return {
      storeId: 1,
      storeName: overrides.storeName,
      metrics: {
        completionRate: overrides.completionRate,
        inProgressRate: 0,
        abandonRate: 0,
        draftRate: 0,
        statusBreakdown: {
          rascunho: 0,
          em_andamento: overrides.em_andamento ?? 0,
          concluido: 0,
          validado: 0,
          incompleto: overrides.incompleto ?? 0,
          total: 10,
        },
      },
      templatesNeverFilled: [],
      ...overrides,
    }
  }

  it('gera warning para lojas com adesao entre 50% e 80%', () => {
    const stores = [makeStoreAdherence({ storeName: 'Loja Centro', completionRate: 65 })]

    const points = generateEnhancedAttentionPoints(stores, [], [], 0, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('warning')
    expect(points[0].text).toContain('Loja Centro')
    expect(points[0].text).toContain('65%')
  })

  it('gera error para lojas com adesao critica (< 50%)', () => {
    const stores = [makeStoreAdherence({
      storeName: 'Loja Sul',
      completionRate: 30,
      em_andamento: 3,
      incompleto: 2,
    })]

    const points = generateEnhancedAttentionPoints(stores, [], [], 0, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('error')
    expect(points[0].text).toContain('Loja Sul')
    expect(points[0].text).toContain('30%')
    expect(points[0].text).toContain('critica')
  })

  it('nao gera alerta para lojas com adesao >= 80%', () => {
    const stores = [makeStoreAdherence({ storeName: 'Loja Top', completionRate: 95 })]

    const points = generateEnhancedAttentionPoints(stores, [], [], 0, [])

    expect(points).toHaveLength(0)
  })

  it('nao gera alerta para lojas com total=0', () => {
    const store = makeStoreAdherence({ storeName: 'Loja Vazia', completionRate: 0 })
    store.metrics.statusBreakdown.total = 0

    const points = generateEnhancedAttentionPoints([store], [], [], 0, [])

    expect(points).toHaveLength(0)
  })

  it('gera warning para lojas com muitos em andamento (>= 5)', () => {
    const store = makeStoreAdherence({
      storeName: 'Loja Engarrafada',
      completionRate: 85, // adesao ok, mas muitos em andamento
      em_andamento: 7,
    })

    const points = generateEnhancedAttentionPoints([store], [], [], 0, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('warning')
    expect(points[0].text).toContain('7 checklists em andamento')
  })

  it('gera error para planos de acao vencidos', () => {
    const points = generateEnhancedAttentionPoints([], [], [], 3, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('error')
    expect(points[0].text).toContain('3 plano(s) de acao vencido(s)')
  })

  it('nao gera alerta quando zero planos vencidos', () => {
    const points = generateEnhancedAttentionPoints([], [], [], 0, [])

    expect(points).toHaveLength(0)
  })

  it('gera error para gaps de cobertura (ate 3 lojas lista nomes)', () => {
    const gaps: CoverageGap[] = [
      { templateId: 1, templateName: 'Checklist Higiene', storeId: 1, storeName: 'Loja A', lastFilledAt: null, daysSinceLastFilled: null },
      { templateId: 1, templateName: 'Checklist Higiene', storeId: 2, storeName: 'Loja B', lastFilledAt: null, daysSinceLastFilled: null },
    ]

    const points = generateEnhancedAttentionPoints([], [], gaps, 0, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('error')
    expect(points[0].text).toContain('Checklist Higiene')
    expect(points[0].text).toContain('Loja A')
    expect(points[0].text).toContain('Loja B')
  })

  it('gera error para gaps de cobertura (> 3 lojas mostra contagem)', () => {
    const gaps: CoverageGap[] = [
      { templateId: 1, templateName: 'Checklist Seguranca', storeId: 1, storeName: 'Loja 1', lastFilledAt: null, daysSinceLastFilled: null },
      { templateId: 1, templateName: 'Checklist Seguranca', storeId: 2, storeName: 'Loja 2', lastFilledAt: null, daysSinceLastFilled: null },
      { templateId: 1, templateName: 'Checklist Seguranca', storeId: 3, storeName: 'Loja 3', lastFilledAt: null, daysSinceLastFilled: null },
      { templateId: 1, templateName: 'Checklist Seguranca', storeId: 4, storeName: 'Loja 4', lastFilledAt: null, daysSinceLastFilled: null },
    ]

    const points = generateEnhancedAttentionPoints([], [], gaps, 0, [])

    expect(points).toHaveLength(1)
    expect(points[0].severity).toBe('error')
    expect(points[0].text).toContain('4 lojas')
    // Nao lista nomes individuais
    expect(points[0].text).not.toContain('Loja 1')
  })

  it('gera warning para templates nao utilizados', () => {
    const unused = ['Checklist Inventario', 'Checklist Abertura']

    const points = generateEnhancedAttentionPoints([], [], [], 0, unused)

    expect(points).toHaveLength(2)
    expect(points[0].severity).toBe('warning')
    expect(points[0].text).toContain('Checklist Inventario')
    expect(points[1].text).toContain('Checklist Abertura')
  })

  it('combina multiplos tipos de alerta', () => {
    const stores = [makeStoreAdherence({ storeName: 'Loja Ruim', completionRate: 20, em_andamento: 1, incompleto: 5 })]
    const gaps: CoverageGap[] = [
      { templateId: 1, templateName: 'T1', storeId: 1, storeName: 'S1', lastFilledAt: null, daysSinceLastFilled: null },
    ]

    const points = generateEnhancedAttentionPoints(stores, [], gaps, 2, ['Checklist Vazio'])

    // 1 error (loja critica) + 1 error (planos vencidos) + 1 error (gap) + 1 warning (template nao usado)
    expect(points.length).toBeGreaterThanOrEqual(4)
    expect(points.filter(p => p.severity === 'error').length).toBeGreaterThanOrEqual(3)
    expect(points.filter(p => p.severity === 'warning').length).toBeGreaterThanOrEqual(1)
  })
})
