import { describe, it, expect } from 'vitest'
import {
  computeStatusBreakdown,
  computeAdherenceMetrics,
  computeOverallAdherence,
  computeAvgCompletionTime,
  computeTemplateAdherence,
  computeStoreAdherence,
  computeUserAdherence,
  computeCoverageGaps,
  computeDailyStatusStats,
  generateEnhancedAttentionPoints,
  formatMinutes,
} from '../adherenceCalculations'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeChecklist(overrides: Partial<{
  id: number
  store_id: number
  template_id: number
  sector_id: number | null
  status: string
  created_by: string
  started_at: string | null
  created_at: string
  completed_at: string | null
}> = {}) {
  return {
    id: 1,
    store_id: 1,
    template_id: 1,
    sector_id: null,
    status: 'concluido',
    created_by: 'user-1',
    started_at: '2026-01-01T08:00:00Z',
    created_at: '2026-01-01T08:00:00Z',
    completed_at: '2026-01-01T09:00:00Z',
    ...overrides,
  }
}

// ─── computeStatusBreakdown ───────────────────────────────────────────────

describe('computeStatusBreakdown', () => {
  it('conta cada status corretamente', () => {
    const result = computeStatusBreakdown([
      { status: 'concluido' },
      { status: 'concluido' },
      { status: 'validado' },
      { status: 'em_andamento' },
      { status: 'rascunho' },
      { status: 'incompleto' },
    ])
    expect(result.concluido).toBe(2)
    expect(result.validado).toBe(1)
    expect(result.em_andamento).toBe(1)
    expect(result.rascunho).toBe(1)
    expect(result.incompleto).toBe(1)
    expect(result.total).toBe(6)
  })

  it('retorna zeros para array vazio', () => {
    const result = computeStatusBreakdown([])
    expect(result.total).toBe(0)
    expect(result.concluido).toBe(0)
  })

  it('ignora status desconhecido (não incrementa nenhum campo nomeado)', () => {
    const result = computeStatusBreakdown([{ status: 'desconhecido' }])
    expect(result.total).toBe(1)
    expect(result.concluido + result.validado + result.em_andamento + result.rascunho + result.incompleto).toBe(0)
  })
})

// ─── computeAdherenceMetrics ─────────────────────────────────────────────

describe('computeAdherenceMetrics', () => {
  it('calcula taxas percentuais corretamente', () => {
    const breakdown = {
      concluido: 6, validado: 2, em_andamento: 1, rascunho: 1, incompleto: 0, total: 10,
    }
    const metrics = computeAdherenceMetrics(breakdown)
    expect(metrics.completionRate).toBe(80)  // (6+2)/10
    expect(metrics.inProgressRate).toBe(10)
    expect(metrics.draftRate).toBe(10)
    expect(metrics.abandonRate).toBe(0)
  })

  it('evita divisão por zero quando total = 0', () => {
    const breakdown = {
      concluido: 0, validado: 0, em_andamento: 0, rascunho: 0, incompleto: 0, total: 0,
    }
    const metrics = computeAdherenceMetrics(breakdown)
    expect(metrics.completionRate).toBe(0)
    expect(metrics.inProgressRate).toBe(0)
  })

  it('inclui o statusBreakdown de entrada', () => {
    const breakdown = {
      concluido: 3, validado: 0, em_andamento: 0, rascunho: 0, incompleto: 0, total: 3,
    }
    expect(computeAdherenceMetrics(breakdown).statusBreakdown).toBe(breakdown)
  })
})

// ─── computeOverallAdherence ─────────────────────────────────────────────

describe('computeOverallAdherence', () => {
  it('atalho equivale a breakdown + metrics', () => {
    const checklists = [
      { status: 'concluido' },
      { status: 'validado' },
      { status: 'em_andamento' },
    ]
    const result = computeOverallAdherence(checklists)
    expect(result.completionRate).toBe(67) // (1+1)/3 ≈ 67%
    expect(result.inProgressRate).toBe(33)
  })
})

// ─── computeAvgCompletionTime ─────────────────────────────────────────────

describe('computeAvgCompletionTime', () => {
  it('calcula media em minutos', () => {
    const checklists = [
      makeChecklist({ started_at: '2026-01-01T08:00:00Z', completed_at: '2026-01-01T09:00:00Z' }), // 60min
      makeChecklist({ started_at: '2026-01-01T08:00:00Z', completed_at: '2026-01-01T08:30:00Z' }), // 30min
    ]
    expect(computeAvgCompletionTime(checklists)).toBe(45)
  })

  it('retorna null quando nenhum checklist tem started_at + completed_at', () => {
    const checklists = [makeChecklist({ started_at: null, completed_at: null })]
    expect(computeAvgCompletionTime(checklists)).toBeNull()
  })

  it('ignora itens com diferença negativa', () => {
    const checklists = [
      makeChecklist({ started_at: '2026-01-01T09:00:00Z', completed_at: '2026-01-01T08:00:00Z' }),
    ]
    expect(computeAvgCompletionTime(checklists)).toBeNull()
  })

  it('retorna null para array vazio', () => {
    expect(computeAvgCompletionTime([])).toBeNull()
  })
})

// ─── computeTemplateAdherence ────────────────────────────────────────────

describe('computeTemplateAdherence', () => {
  const templates = [
    { id: 1, name: 'Abertura' },
    { id: 2, name: 'Fechamento' },
  ]
  const visibility = [
    { template_id: 1, store_id: 10 },
    { template_id: 1, store_id: 20 },
    { template_id: 2, store_id: 10 },
  ]

  it('calcula metricas por template', () => {
    const checklists = [
      makeChecklist({ template_id: 1, store_id: 10, status: 'concluido' }),
      makeChecklist({ template_id: 1, store_id: 10, status: 'incompleto' }),
    ]
    const result = computeTemplateAdherence(checklists, templates, visibility)
    const t1 = result.find(r => r.templateId === 1)!
    expect(t1.metrics.completionRate).toBe(50)
    expect(t1.storesWithZero).toBe(1) // loja 20 sem nenhum checklist
    expect(t1.totalAssignedStores).toBe(2)
  })

  it('ordena por completionRate crescente', () => {
    const checklists = [
      makeChecklist({ template_id: 1, status: 'concluido' }),
      makeChecklist({ template_id: 1, status: 'concluido' }),
      makeChecklist({ template_id: 2, status: 'incompleto' }),
    ]
    const result = computeTemplateAdherence(checklists, templates, visibility)
    expect(result[0].metrics.completionRate).toBeLessThanOrEqual(result[1].metrics.completionRate)
  })
})

// ─── computeStoreAdherence ───────────────────────────────────────────────

describe('computeStoreAdherence', () => {
  const stores = [{ id: 10, name: 'Loja Centro' }, { id: 20, name: 'Loja Norte' }]
  const templates = [{ id: 1, name: 'Abertura' }, { id: 2, name: 'Fechamento' }]
  const visibility = [
    { template_id: 1, store_id: 10 },
    { template_id: 2, store_id: 10 },
    { template_id: 1, store_id: 20 },
  ]

  it('detecta templates nunca preenchidos na loja', () => {
    const checklists = [makeChecklist({ store_id: 10, template_id: 1, status: 'concluido' })]
    const result = computeStoreAdherence(checklists, stores, templates, visibility)
    const lojaCentro = result.find(r => r.storeId === 10)!
    expect(lojaCentro.templatesNeverFilled).toContain('Fechamento')
    expect(lojaCentro.templatesNeverFilled).not.toContain('Abertura')
  })

  it('ordena por completionRate crescente', () => {
    const checklists = [
      makeChecklist({ store_id: 10, status: 'concluido' }),
      makeChecklist({ store_id: 20, status: 'incompleto' }),
    ]
    const result = computeStoreAdherence(checklists, stores, templates, visibility)
    expect(result[0].metrics.completionRate).toBeLessThanOrEqual(result[1].metrics.completionRate)
  })
})

// ─── computeUserAdherence ────────────────────────────────────────────────

describe('computeUserAdherence', () => {
  const users = [
    { id: 'user-1', full_name: 'Ana' },
    { id: 'user-2', full_name: 'Bruno' },
  ]

  it('agrupa checklists por usuario', () => {
    const checklists = [
      makeChecklist({ created_by: 'user-1', status: 'concluido' }),
      makeChecklist({ created_by: 'user-1', status: 'concluido' }),
      makeChecklist({ created_by: 'user-2', status: 'incompleto' }),
    ]
    const result = computeUserAdherence(checklists, users)
    const ana = result.find(r => r.userId === 'user-1')!
    const bruno = result.find(r => r.userId === 'user-2')!
    expect(ana.metrics.completionRate).toBe(100)
    expect(bruno.metrics.completionRate).toBe(0)
  })

  it('usa "Desconhecido" para usuarios fora do lookup', () => {
    const checklists = [makeChecklist({ created_by: 'user-999', status: 'concluido' })]
    const result = computeUserAdherence(checklists, users)
    expect(result[0].userName).toBe('Desconhecido')
  })
})

// ─── computeCoverageGaps ─────────────────────────────────────────────────

describe('computeCoverageGaps', () => {
  it('detecta combinacao template+loja sem nenhum checklist', () => {
    const checklists = [makeChecklist({ template_id: 1, store_id: 10 })]
    const templates = [{ id: 1, name: 'Abertura' }, { id: 2, name: 'Fechamento' }]
    const stores = [{ id: 10, name: 'Centro' }, { id: 20, name: 'Norte' }]
    const visibility = [
      { template_id: 1, store_id: 10 },
      { template_id: 1, store_id: 20 }, // gap: template 1 na loja 20
      { template_id: 2, store_id: 10 }, // gap: template 2 na loja 10
    ]
    const gaps = computeCoverageGaps(checklists, templates, stores, visibility)
    expect(gaps.length).toBe(2)
    const names = gaps.map(g => `${g.templateName}|${g.storeName}`)
    expect(names).toContain('Abertura|Norte')
    expect(names).toContain('Fechamento|Centro')
  })

  it('retorna array vazio quando tudo foi preenchido', () => {
    const checklists = [
      makeChecklist({ template_id: 1, store_id: 10 }),
    ]
    const templates = [{ id: 1, name: 'Abertura' }]
    const stores = [{ id: 10, name: 'Centro' }]
    const visibility = [{ template_id: 1, store_id: 10 }]
    expect(computeCoverageGaps(checklists, templates, stores, visibility)).toHaveLength(0)
  })
})

// ─── computeDailyStatusStats ─────────────────────────────────────────────

describe('computeDailyStatusStats', () => {
  it('retorna o numero correto de dias', () => {
    const result = computeDailyStatusStats([], 7)
    expect(result).toHaveLength(7)

    const result30 = computeDailyStatusStats([], 30)
    expect(result30).toHaveLength(30)
  })

  it('formata datas no padrao DD/MM', () => {
    const result = computeDailyStatusStats([], 3)
    expect(result[0].date).toMatch(/^\d{2}\/\d{2}$/)
  })

  it('conta checklists do dia correto', () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    const checklists = [makeChecklist({ created_at: today.toISOString(), status: 'concluido' })]
    const result = computeDailyStatusStats(checklists, 3)
    const todayEntry = result[result.length - 1]
    expect(todayEntry.concluido).toBe(1)
    expect(todayEntry.total).toBe(1)
  })

  it('retorna zeros para dias sem checklists', () => {
    const result = computeDailyStatusStats([], 5)
    for (const day of result) {
      expect(day.total).toBe(0)
    }
  })
})

// ─── generateEnhancedAttentionPoints ─────────────────────────────────────

describe('generateEnhancedAttentionPoints', () => {
  function makeStore(id: number, name: string, completionRate: number, em_andamento = 0) {
    return {
      storeId: id,
      storeName: name,
      metrics: {
        completionRate,
        inProgressRate: 0,
        abandonRate: 0,
        draftRate: 0,
        statusBreakdown: { concluido: completionRate, validado: 0, em_andamento, rascunho: 0, incompleto: 0, total: 100 },
      },
      templatesNeverFilled: [],
    }
  }

  it('gera error para loja com adesao < 50%', () => {
    const points = generateEnhancedAttentionPoints(
      [makeStore(1, 'Loja X', 40)], [], [], 0, [],
    )
    const err = points.find(p => p.severity === 'error')
    expect(err).toBeDefined()
    expect(err?.text).toContain('Loja X')
  })

  it('gera warning para loja com adesao entre 50 e 79%', () => {
    const points = generateEnhancedAttentionPoints(
      [makeStore(1, 'Loja Y', 60)], [], [], 0, [],
    )
    expect(points[0].severity).toBe('warning')
  })

  it('nao gera ponto para loja com adesao >= 80%', () => {
    const points = generateEnhancedAttentionPoints(
      [makeStore(1, 'Loja Z', 90)], [], [], 0, [],
    )
    expect(points).toHaveLength(0)
  })

  it('ignora loja sem checklists (total = 0)', () => {
    const store = makeStore(1, 'Vazia', 0)
    store.metrics.statusBreakdown.total = 0
    const points = generateEnhancedAttentionPoints([store], [], [], 0, [])
    expect(points).toHaveLength(0)
  })

  it('gera warning para loja com >= 5 checklists em andamento', () => {
    const points = generateEnhancedAttentionPoints(
      [makeStore(1, 'Loja A', 80, 5)], [], [], 0, [],
    )
    const w = points.find(p => p.text.includes('em andamento'))
    expect(w?.severity).toBe('warning')
  })

  it('gera error para planos vencidos', () => {
    const points = generateEnhancedAttentionPoints([], [], [], 3, [])
    expect(points[0].text).toContain('3 plano(s)')
    expect(points[0].severity).toBe('error')
  })

  it('gera error para lacunas de cobertura (ate 3 lojas)', () => {
    const gaps = [
      { templateName: 'Abertura', storeName: 'Centro', templateId: 1, storeId: 10, lastFilledAt: null, daysSinceLastFilled: null },
    ]
    const points = generateEnhancedAttentionPoints([], [], gaps, 0, [])
    expect(points[0].severity).toBe('error')
    expect(points[0].text).toContain('Centro')
  })

  it('gera warning para template nunca preenchido no periodo', () => {
    const points = generateEnhancedAttentionPoints([], [], [], 0, ['Fechamento'])
    expect(points[0].severity).toBe('warning')
    expect(points[0].text).toContain('Fechamento')
  })
})

// ─── formatMinutes ───────────────────────────────────────────────────────

describe('formatMinutes', () => {
  it('retorna "--" para null', () => {
    expect(formatMinutes(null)).toBe('--')
  })

  it('formata minutos < 60 como "Xmin"', () => {
    expect(formatMinutes(0)).toBe('0min')
    expect(formatMinutes(45)).toBe('45min')
    expect(formatMinutes(59)).toBe('59min')
  })

  it('formata horas exatas sem minuto residual', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
  })

  it('formata horas com minutos residuais', () => {
    expect(formatMinutes(90)).toBe('1h 30min')
    expect(formatMinutes(125)).toBe('2h 5min')
  })
})
