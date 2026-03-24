import { describe, it, expect, vi, beforeEach } from 'vitest'

// fullLogout usa window.location.href para redirecionar
// Precisamos interceptar o redirect sem causar erro de navegação
beforeEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()

  // Stub window.location.href para não disparar navegação real
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '' },
  })
})

describe('fullLogout', () => {
  it('chama supabase.auth.signOut', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const supabase = { auth: { signOut } }

    const { fullLogout } = await import('../logout')
    await fullLogout(supabase)

    expect(signOut).toHaveBeenCalledOnce()
  })

  it('redireciona para "/" apos logout', async () => {
    const supabase = { auth: { signOut: vi.fn().mockResolvedValue({}) } }

    const { fullLogout } = await import('../logout')
    await fullLogout(supabase)

    expect(window.location.href).toBe('/')
  })

  it('limpa localStorage e sessionStorage', async () => {
    localStorage.setItem('tema', 'dark')
    sessionStorage.setItem('token', 'abc')

    const supabase = { auth: { signOut: vi.fn().mockResolvedValue({}) } }
    const { fullLogout } = await import('../logout')
    await fullLogout(supabase)

    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('nao lança erro mesmo quando signOut falha', async () => {
    const supabase = { auth: { signOut: vi.fn().mockRejectedValue(new Error('sem sessao')) } }

    const { fullLogout } = await import('../logout')
    await expect(fullLogout(supabase)).resolves.not.toThrow()
    // Ainda deve redirecionar
    expect(window.location.href).toBe('/')
  })

  it('nao lança erro quando clearAllCache falha (resiliente)', async () => {
    // offlineCache pode falhar em environments sem IndexedDB completo
    const supabase = { auth: { signOut: vi.fn().mockResolvedValue({}) } }

    const { fullLogout } = await import('../logout')
    // Não deve lançar
    await expect(fullLogout(supabase)).resolves.not.toThrow()
  })
})
