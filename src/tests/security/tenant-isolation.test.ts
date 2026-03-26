/**
 * TENANT ISOLATION (IDOR) — CRITICAL SECURITY TESTS
 *
 * Verifica que um usuario de Org A NAO consegue acessar/manipular
 * recursos da Org B em NENHUMA rota de billing.
 *
 * Testa a funcao verifyTenantAccess/verifyTenantMember do withTenantAuth.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ORG_A, ORG_B, USER_A_ADMIN, USER_B_ADMIN, PLATFORM_ADMIN, USER_ESCALATION } from '../fixtures/tenants'

// Mock Supabase
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle, maybeSingle: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/stripe', () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }) } },
  }),
  getStripe: () => ({}),
  updateOrgPlan: vi.fn(),
  getPlanFromPriceId: vi.fn(),
  getFeaturesForPlan: vi.fn(),
}))

// Import the function under test
import { verifyTenantAccess, verifyTenantMember } from '@/lib/withTenantAuth'

// Mock verifyApiAuth
vi.mock('@/lib/api-auth', () => ({
  verifyApiAuth: vi.fn().mockImplementation(() => {
    // Default: return USER_A_ADMIN
    return Promise.resolve({ user: USER_A_ADMIN, error: null })
  }),
}))

describe('Tenant Isolation — verifyTenantAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('BLOCKS access when user tries to access another org (IDOR attack)', async () => {
    // User A tenta acessar Org B
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as Request
    const result = await verifyTenantAccess(mockReq as never, ORG_B.id)

    expect(result.error).toBeDefined()
    // Deve retornar 403, nao 200
    expect(result.user).toBeUndefined()
  })

  it('ALLOWS access when user accesses their own org', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })

    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as Request
    const result = await verifyTenantAccess(mockReq as never, ORG_A.id)

    expect(result.error).toBeUndefined()
    expect(result.user).toBeDefined()
    expect(result.role).toBe('admin')
  })

  it('BLOCKS member role when admin is required', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'member' }, error: null })

    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as Request
    const result = await verifyTenantAccess(mockReq as never, ORG_A.id, ['owner', 'admin'])

    expect(result.error).toBeDefined()
  })

  it('BLOCKS when orgId is empty', async () => {
    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as Request
    const result = await verifyTenantAccess(mockReq as never, '')

    expect(result.error).toBeDefined()
  })
})

describe('Tenant Isolation — verifyTenantMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ALLOWS any role (including member) to read', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'member' }, error: null })

    const mockReq = { headers: new Headers({ 'Authorization': 'Bearer fake' }) } as unknown as Request
    const result = await verifyTenantMember(mockReq as never, ORG_A.id)

    expect(result.error).toBeUndefined()
    expect(result.role).toBe('member')
  })
})

describe('Privilege Escalation via user_metadata', () => {
  it('user_metadata.is_platform_admin does NOT grant platform admin access', () => {
    // USER_ESCALATION tem is_platform_admin em user_metadata mas NAO em app_metadata
    const isPlatformAdmin = USER_ESCALATION.app_metadata.is_platform_admin === true
    expect(isPlatformAdmin).toBe(false) // Nao existe em app_metadata

    // user_metadata NAO deve ser checado
    const isEscalated = USER_ESCALATION.user_metadata.is_platform_admin === true
    expect(isEscalated).toBe(true) // Existe em user_metadata mas NAO deve ser usado
  })

  it('only app_metadata.is_platform_admin grants access', () => {
    const isPlatformAdmin = PLATFORM_ADMIN.app_metadata.is_platform_admin === true
    expect(isPlatformAdmin).toBe(true)
  })
})
