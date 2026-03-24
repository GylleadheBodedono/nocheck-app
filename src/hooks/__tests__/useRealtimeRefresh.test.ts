import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock do cliente Supabase
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase'

function makeSupabaseMock() {
  let capturedCallback: (() => void) | null = null

  const channelObj = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation(function(this: typeof channelObj) {
      // extrai o callback registrado no .on(event, filter, callback)
      const onCall = channelObj.on.mock.calls[channelObj.on.mock.calls.length - 1]
      if (onCall?.[2]) capturedCallback = onCall[2]
      return this
    }),
  }

  const removeChannel = vi.fn()
  const channel = vi.fn().mockReturnValue(channelObj)

  const client = { channel, removeChannel }
  vi.mocked(createClient).mockReturnValue(client as ReturnType<typeof createClient>)

  return { channel, channelObj, removeChannel, triggerEvent: () => capturedCallback?.() }
}

describe('useRealtimeRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('inicia refreshKey em 0', async () => {
    makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    const { result } = renderHook(() => useRealtimeRefresh(['checklists']))
    expect(result.current.refreshKey).toBe(0)
  })

  it('incrementa refreshKey ao receber evento do canal', async () => {
    const { triggerEvent } = makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    const { result } = renderHook(() => useRealtimeRefresh(['checklists']))

    act(() => triggerEvent())
    expect(result.current.refreshKey).toBe(1)

    act(() => triggerEvent())
    expect(result.current.refreshKey).toBe(2)
  })

  it('cria um canal por tabela', async () => {
    const { channel } = makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    renderHook(() => useRealtimeRefresh(['checklists', 'action_plans']))
    expect(channel).toHaveBeenCalledTimes(2)
  })

  it('remove canais ao desmontar', async () => {
    const { removeChannel } = makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    const { unmount } = renderHook(() => useRealtimeRefresh(['checklists']))
    unmount()
    expect(removeChannel).toHaveBeenCalled()
  })

  it('nao cria canais quando offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    const { channel } = makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    renderHook(() => useRealtimeRefresh(['checklists']))
    expect(channel).not.toHaveBeenCalled()
  })

  it('nao cria canais quando a lista de tabelas e vazia', async () => {
    const { channel } = makeSupabaseMock()
    const { useRealtimeRefresh } = await import('../useRealtimeRefresh')
    renderHook(() => useRealtimeRefresh([]))
    expect(channel).not.toHaveBeenCalled()
  })
})
