// ============================================
// Testes — verifyApiAuth (autenticacao de API)
// ============================================
// Valida o fluxo de autenticacao em API routes:
//   - Bearer token → fallback cookies
//   - Verificacao de admin quando requireAdmin=true
//   - Respostas de erro (401, 403, 500)
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───

const mockGetUser = vi.fn()
const mockGetUserCookie = vi.fn()
const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUserCookie },
  })),
}))

// Importa DEPOIS dos mocks
import { verifyApiAuth } from '@/lib/api-auth'

// ─── Helpers ───

function makeRequest(opts: { bearer?: string; cookies?: Record<string, string> } = {}) {
  const headers = new Headers()
  if (opts.bearer) {
    headers.set('Authorization', `Bearer ${opts.bearer}`)
  }

  const cookieEntries = Object.entries(opts.cookies || {}).map(([name, value]) => ({ name, value }))

  return {
    headers,
    cookies: {
      getAll: () => cookieEntries,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ─── Testes ───

describe('verifyApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Configurar env vars por padrao
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-test'
  })

  // ─── Env vars ausentes ───

  describe('variaveis de ambiente', () => {
    it('retorna 500 se SUPABASE_URL esta ausente', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toBeNull()
      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('retorna 500 se SUPABASE_ANON_KEY esta ausente', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('retorna 500 se SERVICE_ROLE_KEY esta ausente', async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toBeNull()
      expect(result.error).toBeTruthy()
    })
  })

  // ─── Sem autenticacao ───

  describe('sem autenticacao', () => {
    it('retorna 401 se nenhum usuario encontrado (sem bearer, sem cookies)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'no user' } })
      mockGetUserCookie.mockResolvedValue({ data: { user: null }, error: { message: 'no user' } })

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toBeNull()
      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ─── Bearer token ───

  describe('autenticacao via Bearer token', () => {
    it('retorna sucesso com usuario quando Bearer token e valido', async () => {
      const fakeUser = { id: 'user-123', email: 'test@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      const result = await verifyApiAuth(makeRequest({ bearer: 'valid-token' }))

      expect(result.user).toEqual({ id: 'user-123', email: 'test@example.com' })
      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeNull()
    })

    it('nao chama autenticacao por cookie se Bearer e valido', async () => {
      const fakeUser = { id: 'user-123', email: 'test@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      await verifyApiAuth(makeRequest({ bearer: 'valid-token' }))

      expect(mockGetUserCookie).not.toHaveBeenCalled()
    })
  })

  // ─── Fallback cookies ───

  describe('fallback para cookies', () => {
    it('retorna sucesso com usuario quando cookie auth funciona', async () => {
      // Bearer falha
      mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
      // Cookie funciona
      const fakeUser = { id: 'user-456', email: 'cookie@example.com' }
      mockGetUserCookie.mockResolvedValue({ data: { user: fakeUser }, error: null })

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toEqual({ id: 'user-456', email: 'cookie@example.com' })
      expect(result.error).toBeNull()
    })

    it('usa email vazio se usuario nao tem email', async () => {
      const fakeUser = { id: 'user-no-email' }
      mockGetUserCookie.mockResolvedValue({ data: { user: fakeUser }, error: null })

      const result = await verifyApiAuth(makeRequest())

      expect(result.user).toEqual({ id: 'user-no-email', email: '' })
    })
  })

  // ─── requireAdmin ───

  describe('requireAdmin', () => {
    it('retorna 403 quando requireAdmin=true mas usuario nao e admin', async () => {
      const fakeUser = { id: 'user-789', email: 'normal@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      // Mock da query de admin
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false } }),
          }),
        }),
      })

      const result = await verifyApiAuth(makeRequest({ bearer: 'token' }), true)

      expect(result.user).toBeNull()
      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('retorna 403 quando perfil nao encontrado', async () => {
      const fakeUser = { id: 'user-ghost', email: 'ghost@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      })

      const result = await verifyApiAuth(makeRequest({ bearer: 'token' }), true)

      expect(result.user).toBeNull()
      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('retorna sucesso com isAdmin=true quando usuario e admin', async () => {
      const fakeUser = { id: 'admin-001', email: 'admin@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: true } }),
          }),
        }),
      })

      const result = await verifyApiAuth(makeRequest({ bearer: 'token' }), true)

      expect(result.user).toEqual({ id: 'admin-001', email: 'admin@example.com' })
      expect(result.isAdmin).toBe(true)
      expect(result.error).toBeNull()
    })

    it('nao verifica admin quando requireAdmin=false (padrao)', async () => {
      const fakeUser = { id: 'user-simple', email: 'simple@example.com' }
      mockGetUser.mockResolvedValue({ data: { user: fakeUser }, error: null })

      const result = await verifyApiAuth(makeRequest({ bearer: 'token' }))

      expect(result.isAdmin).toBe(false)
      expect(result.error).toBeNull()
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })
})
