import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createNotification, sendEmailNotification, sendActionPlanEmail, sendActionPlanTeamsAlert } from '../notificationService'

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeSupabaseMock(insertError: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const from = vi.fn().mockReturnValue({ insert })
  return { from, insert }
}

function mockFetch(ok: boolean, body: unknown = { success: true }) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(ok ? '' : 'Erro do servidor'),
  } as Response)
}

beforeEach(() => vi.restoreAllMocks())

// ─── createNotification ───────────────────────────────────────────────────

describe('createNotification', () => {
  it('retorna success=true quando o insert funciona', async () => {
    const { from } = makeSupabaseMock(null)
    const result = await createNotification({ from }, 'user-1', {
      type: 'action_plan_deadline',
      title: 'Lembrete',
      message: 'Prazo chegando',
      link: '/admin/planos/1',
      metadata: { plan_id: 1 },
    })
    expect(result.success).toBe(true)
    expect(from).toHaveBeenCalledWith('notifications')
  })

  it('passa os campos corretos para o insert', async () => {
    const { from, insert } = makeSupabaseMock(null)
    await createNotification({ from }, 'user-abc', {
      type: 'action_plan_update',
      title: 'Titulo',
      message: 'Mensagem',
      link: '/link',
    })
    const payload = insert.mock.calls[0][0]
    expect(payload.user_id).toBe('user-abc')
    expect(payload.type).toBe('action_plan_update')
    expect(payload.title).toBe('Titulo')
    expect(payload.link).toBe('/link')
  })

  it('retorna success=false quando o insert falha', async () => {
    const { from } = makeSupabaseMock({ message: 'duplicado' })
    const result = await createNotification({ from }, 'user-1', {
      type: 'action_plan_deadline',
      title: 'Erro',
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('duplicado')
  })

  it('retorna success=false quando o supabase lança exceção', async () => {
    const broken = { from: () => { throw new Error('conexão perdida') } }
    const result = await createNotification(broken, 'user-1', {
      type: 'action_plan_deadline',
      title: 'Falha',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('conexão perdida')
  })
})

// ─── sendEmailNotification ────────────────────────────────────────────────

describe('sendEmailNotification', () => {
  it('retorna success=true quando fetch responde ok', async () => {
    mockFetch(true)
    const result = await sendEmailNotification('a@b.com', 'Assunto', '<p>corpo</p>')
    expect(result.success).toBe(true)
  })

  it('envia os dados corretos no body', async () => {
    const spy = mockFetch(true)
    await sendEmailNotification('dest@a.com', 'Titulo', '<b>html</b>')
    const body = JSON.parse((spy.mock.calls[0][1]?.body as string) || '{}')
    expect(body.to).toBe('dest@a.com')
    expect(body.subject).toBe('Titulo')
  })

  it('inclui header Authorization quando accessToken fornecido', async () => {
    const spy = mockFetch(true)
    await sendEmailNotification('a@b.com', 'Sub', '<p/>', 'token-xyz')
    const headers = (spy.mock.calls[0][1]?.headers as Record<string, string>) || {}
    expect(headers['Authorization']).toBe('Bearer token-xyz')
  })

  it('retorna success=false quando fetch retorna status de erro', async () => {
    mockFetch(false)
    const result = await sendEmailNotification('a@b.com', 'Sub', '<p/>')
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('retorna success=false quando fetch lança exceção', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('rede indisponível'))
    const result = await sendEmailNotification('a@b.com', 'Sub', '<p/>')
    expect(result.success).toBe(false)
    expect(result.error).toContain('rede indisponível')
  })
})

// ─── sendActionPlanEmail ──────────────────────────────────────────────────

describe('sendActionPlanEmail', () => {
  it('retorna success=true e assigneeName quando ok', async () => {
    mockFetch(true, { success: true, assigneeName: 'João' })
    const result = await sendActionPlanEmail('user-1', 'Plano', '<p/>')
    expect(result.success).toBe(true)
    expect(result.assigneeName).toBe('João')
  })

  it('envia assigneeId no body', async () => {
    const spy = mockFetch(true, { success: true })
    await sendActionPlanEmail('user-abc', 'Sub', '<p/>')
    const body = JSON.parse((spy.mock.calls[0][1]?.body as string) || '{}')
    expect(body.assigneeId).toBe('user-abc')
  })

  it('retorna success=false quando fetch falha', async () => {
    mockFetch(false)
    const result = await sendActionPlanEmail('user-1', 'Sub', '<p/>')
    expect(result.success).toBe(false)
  })
})

// ─── sendActionPlanTeamsAlert ─────────────────────────────────────────────

describe('sendActionPlanTeamsAlert', () => {
  const alertData = {
    title: 'Alerta Teams',
    fieldName: 'Temperatura',
    storeName: 'Loja Norte',
    severity: 'alta',
    deadline: '2026-03-30',
    assigneeName: 'Maria',
    nonConformityValue: 'Não',
    isReincidencia: false,
    reincidenciaCount: 0,
  }

  it('retorna success=true quando fetch ok', async () => {
    mockFetch(true)
    const result = await sendActionPlanTeamsAlert(alertData)
    expect(result.success).toBe(true)
  })

  it('envia action=action_plan no body', async () => {
    const spy = mockFetch(true)
    await sendActionPlanTeamsAlert(alertData)
    const body = JSON.parse((spy.mock.calls[0][1]?.body as string) || '{}')
    expect(body.action).toBe('action_plan')
    expect(body.data.storeName).toBe('Loja Norte')
  })

  it('retorna success=false quando fetch falha', async () => {
    mockFetch(false)
    const result = await sendActionPlanTeamsAlert(alertData)
    expect(result.success).toBe(false)
  })

  it('retorna success=false quando fetch lança exceção', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('timeout'))
    const result = await sendActionPlanTeamsAlert(alertData)
    expect(result.success).toBe(false)
    expect(result.error).toContain('timeout')
  })
})
