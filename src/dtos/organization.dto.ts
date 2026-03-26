// ============================================
// DTOs — Organizações e Membros (Multi-tenant)
// ============================================
// Tipos de transferência para operações de gestão
// de organizações, convites e membros no contexto
// multi-tenant do sistema.
//
// Hierarquia de roles:
//   owner > admin > manager > member > viewer
// ============================================

import type { OrgRole, OrgSettings } from '@/types/tenant'

/**
 * Dados para criar um convite para novo membro da organização.
 * Um e-mail de convite é enviado ao endereço informado.
 */
export interface CreateInviteRequestDTO {
  /** UUID da organização que está convidando */
  orgId: string
  /** E-mail do usuário a ser convidado */
  email: string
  /** Role que será atribuída ao membro ao aceitar o convite */
  role: OrgRole
  /** UUID do usuário que está realizando o convite */
  invitedBy: string
}

/**
 * Dados para aceitar um convite de membro.
 * Vincula o usuário à organização com a role definida no convite.
 */
export interface AcceptInviteRequestDTO {
  /** Token único do convite (gerado no banco de dados) */
  token: string
  /** UUID do usuário que está aceitando o convite */
  userId: string
}

/**
 * Dados para atualizar a role de um membro existente.
 * Requer role mínima de `admin` para executar.
 */
export interface UpdateMemberRoleRequestDTO {
  /** UUID do registro de membership (organization_members.id) */
  memberId: string
  /** Nova role a ser atribuída ao membro */
  role: OrgRole
}

/**
 * Dados para atualizar informações da organização.
 * Apenas campos fornecidos são atualizados (partial update).
 * Requer role mínima de `owner` ou `admin`.
 */
export interface UpdateOrganizationRequestDTO {
  /** Novo nome de exibição da organização */
  name?: string
  /**
   * Configurações parciais da organização.
   * Merged com as configurações existentes (não substitui completamente).
   * Inclui tema (cores, logo), domínio customizado e e-mail remetente.
   */
  settings?: Partial<OrgSettings>
}

/**
 * Resposta após operações de membership (aceitar convite, adicionar membro).
 */
export interface MembershipResponseDTO {
  /** UUID do registro de membership criado */
  id: string
  /** UUID da organização */
  organization_id: string
  /** UUID do usuário */
  user_id: string
  /** Role atribuída */
  role: OrgRole
  /** Timestamp de aceitação do convite */
  accepted_at: string | null
  /** Timestamp de criação do registro */
  created_at: string
}
