// ============================================
// usePermission — Verificacao de permissoes por role
// ============================================
// Usa a hierarquia de roles definida em tenant.ts
// para verificar se o usuario tem uma permissao especifica.
//
// Uso:
//   const { hasPermission } = usePermission()
//   if (hasPermission('manage_members')) { ... }
//
// Hierarquia: owner > admin > manager > member > viewer
// Cada role herda todas as permissoes dos niveis abaixo.
// ============================================

'use client'

import { useCallback } from 'react'
import { useTenant } from './useTenant'
import { ROLE_HIERARCHY, type Permission } from '@/types/tenant'

export function usePermission() {
  const { currentRole, isPlatformAdmin } = useTenant()

  /**
   * Verifica se o usuario atual tem a permissao solicitada.
   * Superadmin (is_platform_admin) tem TODAS as permissoes.
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      // Superadmin pode tudo
      if (isPlatformAdmin) return true

      // Sem role = sem permissao
      if (!currentRole) return false

      // Verificar na hierarquia
      const permissions = ROLE_HIERARCHY[currentRole] ?? []
      return permissions.includes(permission)
    },
    [currentRole, isPlatformAdmin]
  )

  /**
   * Verifica se o role do usuario e igual ou superior ao requerido.
   * Util para checks simples como "precisa ser pelo menos manager".
   */
  const hasMinRole = useCallback(
    (minRole: string): boolean => {
      if (isPlatformAdmin) return true
      if (!currentRole) return false

      const hierarchy = ['viewer', 'member', 'manager', 'admin', 'owner']
      const userLevel = hierarchy.indexOf(currentRole)
      const requiredLevel = hierarchy.indexOf(minRole)
      return userLevel >= requiredLevel
    },
    [currentRole, isPlatformAdmin]
  )

  return { hasPermission, hasMinRole, currentRole, isPlatformAdmin }
}
