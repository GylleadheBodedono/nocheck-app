// ============================================
// TIPOS — Multi-Tenant SaaS OpereCheck
// ============================================
// Defines os tipos para o sistema multi-tenant.
// Tres niveis de usuario:
//   1. Superadmin (is_platform_admin) — controle total da plataforma
//   2. Admin (owner/admin na org) — dono do restaurante que assina o app
//   3. Funcionario (manager/member/viewer) — empregado submisso ao Admin
// ============================================

// --- Planos de assinatura ---
export type Plan = 'trial' | 'starter' | 'professional' | 'enterprise'

// --- Roles dentro de uma organizacao ---
// owner: dono da org (quem criou/assinou)
// admin: gerente geral com quase todos os poderes
// manager: supervisor de loja
// member: funcionario que preenche checklists
// viewer: apenas visualizacao (read-only)
export type OrgRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer'

// --- Feature flags controladas pelo plano ---
export type Feature =
  | 'basic_orders'
  | 'basic_reports'
  | 'cancellations'
  | 'kpi_dashboard'
  | 'bi_dashboard'
  | 'export_excel'
  | 'export_pdf'
  | 'integrations_ifood'
  | 'integrations_teknisa'
  | 'white_label'
  | 'api_access'
  | 'custom_domain'
  | 'audit_logs'
  | 'advanced_analytics'

// --- Configuracoes de tema (white-label) ---
export type ThemeSettings = {
  primaryColor: string
  logoUrl: string | null
  faviconUrl: string | null
  appName: string
}

// --- Configuracoes da organizacao ---
export type OrgSettings = {
  theme: ThemeSettings
  customDomain: string | null
  emailFrom: string | null
}

// --- Organizacao (tenant) ---
export type Organization = {
  id: string
  name: string
  slug: string
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  settings: OrgSettings
  max_users: number
  max_stores: number
  features: Feature[]
  is_active: boolean
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

// --- Membro de uma organizacao ---
export type OrganizationMember = {
  id: string
  organization_id: string
  user_id: string
  role: OrgRole
  invited_by: string | null
  invited_email: string | null
  accepted_at: string | null
  created_at: string
}

// --- Convite pendente ---
export type Invite = {
  id: string
  tenant_id: string
  email: string
  role: OrgRole
  token: string
  invited_by: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

// --- Integracao externa por tenant ---
export type TenantIntegration = {
  id: string
  tenant_id: string
  provider: 'ifood' | 'teknisa' | 'whatsapp' | 'smtp' | 'webhook'
  store_id: number | null // SERIAL id (nao UUID) — compativel com schema existente
  credentials: Record<string, unknown>
  is_active: boolean
  last_sync_at: string | null
  sync_error: string | null
  created_at: string
  updated_at: string
}

// --- JWT App Metadata (extraido do token Supabase pelo custom_access_token_hook) ---
export type AppMetadata = {
  org_id?: string
  org_slug?: string
  role?: OrgRole
  plan?: Plan
  features?: Feature[]
  is_active?: boolean
  is_platform_admin?: boolean // Superadmin da plataforma
}

// --- Contexto completo do tenant (usado no TenantProvider) ---
export type TenantContext = {
  organization: Organization | null
  currentRole: OrgRole | null
  features: Feature[]
  isPlatformAdmin: boolean // Superadmin — controle total
  isOwner: boolean         // Dono da org
  isOrgAdmin: boolean      // Owner ou Admin — pode gerenciar a org
  isManager: boolean       // Owner, Admin ou Manager
  orgSlug: string | null
  isLoading: boolean
}

// --- Permissoes mapeadas por role ---
export type Permission =
  | 'manage_billing'     // Apenas owner
  | 'manage_members'     // Owner, admin
  | 'manage_stores'      // Owner, admin
  | 'manage_templates'   // Owner, admin, manager
  | 'view_reports'       // Owner, admin, manager
  | 'fill_checklists'    // Owner, admin, manager, member
  | 'view_checklists'    // Todos

// --- Hierarquia de roles: cada role herda as permissoes abaixo ---
export const ROLE_HIERARCHY: Record<OrgRole, Permission[]> = {
  owner: ['manage_billing', 'manage_members', 'manage_stores', 'manage_templates', 'view_reports', 'fill_checklists', 'view_checklists'],
  admin: ['manage_members', 'manage_stores', 'manage_templates', 'view_reports', 'fill_checklists', 'view_checklists'],
  manager: ['manage_templates', 'view_reports', 'fill_checklists', 'view_checklists'],
  member: ['fill_checklists', 'view_checklists'],
  viewer: ['view_checklists'],
}

// --- Configuracao de plano (precos, limites, features) ---
export type PlanConfig = {
  id: Plan
  name: string
  price: number       // R$ por mes
  maxUsers: number
  maxStores: number
  features: Feature[]
  stripePriceId: string
}

export const PLAN_CONFIGS: Record<Plan, PlanConfig> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: 0,
    maxUsers: 3,
    maxStores: 1,
    features: ['basic_orders', 'basic_reports'],
    stripePriceId: '',
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 297,
    maxUsers: 5,
    maxStores: 3,
    features: ['basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard'],
    stripePriceId: 'price_1TC1hW2FHw3Dg8PTnfIwKE4C',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 597,
    maxUsers: 15,
    maxStores: 10,
    features: [
      'basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard',
      'bi_dashboard', 'export_excel', 'export_pdf',
      'integrations_ifood', 'integrations_teknisa',
    ],
    stripePriceId: 'price_1TC1hW2FHw3Dg8PT5yc0BWz8',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 997,
    maxUsers: 999,
    maxStores: 999,
    features: [
      'basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard',
      'bi_dashboard', 'export_excel', 'export_pdf',
      'integrations_ifood', 'integrations_teknisa',
      'white_label', 'api_access', 'custom_domain', 'audit_logs', 'advanced_analytics',
    ],
    stripePriceId: 'price_1TC1hX2FHw3Dg8PTCTHGGNZH',
  },
}
