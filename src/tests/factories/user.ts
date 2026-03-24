import type { User } from '@/types/database'

/** Cria um usuário operador com valores padrão sobrescrevíveis. */
export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'operador@teste.com',
    full_name: 'Operador Teste',
    phone: null,
    store_id: 1,
    function_id: 1,
    sector_id: null,
    is_admin: false,
    is_tech: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User
}

/** Cria um usuário administrador. */
export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({
    id: 'admin-456',
    email: 'admin@teste.com',
    full_name: 'Admin Teste',
    store_id: null,
    function_id: null,
    is_admin: true,
    ...overrides,
  })
}
