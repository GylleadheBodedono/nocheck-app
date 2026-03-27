// ============================================
// DTOs — Convites de Funcionarios
// ============================================
// Tipos de transferencia de dados para validacao,
// aceitacao e criacao em massa de convites.
// ============================================

import type { OrgRole } from '@/types/tenant'

/**
 * Resposta do GET /api/invites/validate
 * Retornada quando um token de convite e validado publicamente.
 */
export interface ValidateInviteResponseDTO {
  valid: boolean
  email?: string
  role?: OrgRole
  orgName?: string
  reason?: 'expired' | 'used' | 'not_found'
}

/**
 * Body do POST /api/invites/accept (registro de funcionario)
 */
export interface AcceptInviteApiRequestDTO {
  token: string
}

/**
 * Resposta do POST /api/invites/accept
 */
export interface AcceptInviteApiResponseDTO {
  success: boolean
  orgId?: string
  role?: OrgRole
  error?: string
}

/**
 * Item individual de convite para criacao em massa.
 */
export interface InviteItemDTO {
  email: string
  role: OrgRole
}

/**
 * Body do POST /api/admin/invites
 */
export interface BulkInviteRequestDTO {
  invites: InviteItemDTO[]
}

/**
 * Resposta do POST /api/admin/invites
 */
export interface BulkInviteResponseDTO {
  created: number
  errors: Array<{ email: string; reason: string }>
}

/**
 * Resposta do POST /api/admin/invites/csv
 */
export interface CsvInviteResponseDTO {
  created: number
  skipped: number
  errors: Array<{ line: number; email: string; reason: string }>
}
