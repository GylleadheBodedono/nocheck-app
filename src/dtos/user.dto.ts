// ============================================
// DTOs — Usuários e Administração
// ============================================
// Tipos de transferência de dados para criação,
// atualização e listagem de usuários no sistema.
//
// Padrão de nomenclatura:
//   *RequestDTO  — body de requisição de API
//   *ResponseDTO — body de resposta de API
//   *DTO         — estrutura de dado compartilhada
// ============================================

import type { Store, FunctionRow, Sector, UserStore } from '@/types/database'

/**
 * Atribuição de loja para um usuário.
 * Usada ao criar ou editar usuários com múltiplas lojas.
 */
export interface StoreAssignmentDTO {
  /** ID da loja (SERIAL do banco) */
  store_id: number
  /** ID do setor dentro da loja (opcional) */
  sector_id: number | null
  /** Se esta é a loja principal do usuário */
  is_primary: boolean
}

/**
 * Body do POST /api/admin/users
 * Contém todos os dados necessários para criar um novo usuário no sistema.
 * Os campos `email`, `password` e `fullName` são obrigatórios.
 */
export interface CreateUserRequestDTO {
  /** E-mail do usuário — deve ser único no sistema */
  email: string
  /** Senha inicial do usuário */
  password: string
  /** Nome completo do usuário */
  fullName: string
  /** Telefone de contato (opcional) */
  phone?: string
  /** Se o usuário tem permissões de administrador */
  isAdmin: boolean
  /** Se o usuário é técnico de suporte interno */
  isTech?: boolean
  /**
   * Se true, confirma o e-mail automaticamente (sem enviar e-mail de confirmação).
   * Útil para criação em massa ou ambientes de desenvolvimento.
   */
  autoConfirm?: boolean
  /** ID da loja principal (formato legado — prefira `storeAssignments`) */
  storeId?: number
  /** ID da função/cargo do usuário */
  functionId?: number
  /** ID do setor do usuário */
  sectorId?: number
  /**
   * Lista de atribuições de lojas (formato novo — suporta múltiplas lojas).
   * Quando fornecido, sobrepõe `storeId`.
   */
  storeAssignments?: StoreAssignmentDTO[]
  /** URL para onde o usuário será redirecionado após confirmar o e-mail */
  redirectTo?: string
}

/**
 * Resposta do POST /api/admin/users em caso de sucesso.
 */
export interface CreateUserResponseDTO {
  /** Indica que o usuário foi criado com sucesso */
  success: boolean
  /**
   * Se true, o usuário ainda precisa confirmar o e-mail antes de acessar o sistema.
   * Um e-mail de confirmação foi enviado via Resend.
   */
  needsConfirmation: boolean
  /** Dados básicos do usuário recém-criado */
  user: {
    /** UUID do usuário no Supabase Auth */
    id: string
    email: string
  }
}

/**
 * Representação de um usuário com suas relações (loja, função, setor, lojas adicionais).
 * Retornado na listagem do GET /api/admin/users.
 */
export interface UserWithRelationsDTO {
  id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  is_tech: boolean
  store_id: number | null
  function_id: number | null
  sector_id: number | null
  tenant_id: string | null
  created_at: string
  updated_at: string
  /** Loja principal do usuário */
  store: Store | null
  /** Função/cargo do usuário */
  function_ref: FunctionRow | null
  /** Setor do usuário */
  sector: Sector | null
  /** Todas as lojas vinculadas ao usuário (via tabela user_stores) */
  user_stores: (Pick<UserStore, 'id' | 'store_id' | 'sector_id' | 'is_primary' | 'created_at'> & {
    store: Store
    sector: Sector | null
  })[]
}

/**
 * Resposta do GET /api/admin/users.
 * Inclui a lista de usuários e a quantidade de registros sincronizados
 * do auth.users para public.users durante a requisição.
 */
export interface ListUsersResponseDTO {
  /** Lista de usuários com relações populadas */
  users: UserWithRelationsDTO[]
  /** Quantidade de usuários sincronizados nesta chamada */
  synced: number
}
