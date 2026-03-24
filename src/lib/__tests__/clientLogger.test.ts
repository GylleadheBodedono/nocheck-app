import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de @/lib/supabase antes de importar o módulo testado
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase'

// Helpers para construir o mock do Supabase
function makeMockInsert(error: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ data: null, error })
  const from = vi.fn().mockReturnValue({ insert })
  return { from, insert }
}

function makeMockClient(insertError: unknown = null) {
  const { from, insert } = makeMockInsert(insertError)
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-abc' } } }),
    },
    from,
  }
  return { client, from, insert }
}

describe('clientLogger', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  describe('logError', () => {
    it('chama sendLog com level=error e mensagem correta', async () => {
      const { client, from, insert } = makeMockClient()
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)

      const { logError } = await import('../clientLogger')
      logError('falha crítica', { page: '/dashboard' })

      // fire-and-forget: aguarda microtask
      await new Promise(r => setTimeout(r, 0))

      expect(from).toHaveBeenCalledWith('client_logs')
      const payload = insert.mock.calls[0][0]
      expect(payload.level).toBe('error')
      expect(payload.message).toBe('falha crítica')
      expect(payload.context).toEqual({ page: '/dashboard' })
      expect(payload.user_id).toBe('user-abc')
    })
  })

  describe('logWarn', () => {
    it('chama sendLog com level=warn', async () => {
      const { client, from, insert } = makeMockClient()
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)

      const { logWarn } = await import('../clientLogger')
      logWarn('aviso de performance')

      await new Promise(r => setTimeout(r, 0))

      expect(from).toHaveBeenCalledWith('client_logs')
      expect(insert.mock.calls[0][0].level).toBe('warn')
    })
  })

  describe('logInfo', () => {
    it('chama sendLog com level=info', async () => {
      const { client, insert } = makeMockClient()
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)

      const { logInfo } = await import('../clientLogger')
      logInfo('checklist salvo')

      await new Promise(r => setTimeout(r, 0))

      expect(insert.mock.calls[0][0].level).toBe('info')
    })
  })

  describe('sendLog — truncamento de mensagem', () => {
    it('trunca mensagem longa para 2000 chars', async () => {
      const { client, insert } = makeMockClient()
      vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)

      const { logError } = await import('../clientLogger')
      logError('x'.repeat(3000))

      await new Promise(r => setTimeout(r, 0))

      expect(insert.mock.calls[0][0].message).toHaveLength(2000)
    })
  })

  describe('sendLog — falha silenciosa', () => {
    it('nao lança erro quando o supabase falha', async () => {
      vi.mocked(createClient).mockImplementation(() => {
        throw new Error('conexão recusada')
      })

      const { logError } = await import('../clientLogger')
      // Não deve lançar
      expect(() => logError('qualquer coisa')).not.toThrow()
    })
  })

  describe('initClientLogger', () => {
    it('registra listeners de error e unhandledrejection', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      const { initClientLogger } = await import('../clientLogger')
      initClientLogger()

      const events = addSpy.mock.calls.map(([e]) => e)
      expect(events).toContain('error')
      expect(events).toContain('unhandledrejection')
    })

    it('é idempotente: segunda chamada não duplica listeners', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener')
      const before = addSpy.mock.calls.length

      const { initClientLogger } = await import('../clientLogger')
      initClientLogger()
      initClientLogger()

      const after = addSpy.mock.calls.length
      // Só deve ter adicionado listeners na primeira chamada
      expect(after - before).toBeLessThanOrEqual(2)
    })
  })
})
