// ============================================
// TenantGuard — Protecao de rotas por role/feature
// ============================================
// Componente wrapper que verifica se o usuario tem
// o role ou feature necessario para acessar a pagina.
// Se nao tiver, mostra uma tela de acesso negado.
//
// Uso:
//   <TenantGuard requiredRole="admin">
//     <AdminPage />
//   </TenantGuard>
//
//   <TenantGuard requiredFeature="export_excel">
//     <ExportButton />
//   </TenantGuard>
//
//   <TenantGuard platformAdminOnly>
//     <PlatformDashboard />
//   </TenantGuard>
// ============================================

'use client'

import { useTenant } from '@/hooks/useTenant'
import { usePermission } from '@/hooks/usePermission'
import { useFeature } from '@/hooks/useFeature'
import { FiLock } from 'react-icons/fi'
import type { Permission, Feature, OrgRole } from '@/types/tenant'

interface TenantGuardProps {
  children: React.ReactNode
  /** Role minimo necessario (usa hierarquia: owner > admin > manager > member > viewer) */
  requiredRole?: OrgRole
  /** Permissao especifica necessaria */
  requiredPermission?: Permission
  /** Feature flag necessaria (baseada no plano) */
  requiredFeature?: Feature
  /** Somente superadmin da plataforma */
  platformAdminOnly?: boolean
  /** Componente customizado para acesso negado (opcional) */
  fallback?: React.ReactNode
}

export function TenantGuard({
  children,
  requiredRole,
  requiredPermission,
  requiredFeature,
  platformAdminOnly,
  fallback,
}: TenantGuardProps) {
  const { isPlatformAdmin, isLoading } = useTenant()
  const { hasPermission, hasMinRole } = usePermission()
  const { hasFeature } = useFeature()

  // Enquanto carrega, nao mostra nada (evita flash de conteudo)
  if (isLoading) return null

  // Verificar superadmin
  if (platformAdminOnly && !isPlatformAdmin) {
    return fallback ?? <AccessDenied message="Acesso restrito a administradores da plataforma." />
  }

  // Verificar role minimo
  if (requiredRole && !isPlatformAdmin && !hasMinRole(requiredRole)) {
    return fallback ?? <AccessDenied message={`Você precisa ser pelo menos ${requiredRole} para acessar esta página.`} />
  }

  // Verificar permissao especifica
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback ?? <AccessDenied message="Você não tem permissão para acessar esta página." />
  }

  // Verificar feature flag
  if (requiredFeature && !hasFeature(requiredFeature)) {
    return fallback ?? <AccessDenied message="Esta funcionalidade não está disponível no seu plano atual." />
  }

  return <>{children}</>
}

// --- Componente padrao de acesso negado ---
function AccessDenied({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
          <FiLock className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-lg font-bold text-main mb-2">Acesso Negado</h2>
        <p className="text-sm text-muted">{message}</p>
      </div>
    </div>
  )
}
