/**
 * Fixtures para testes de isolamento multi-tenant.
 * Define 2 orgs e 4 usuarios para simular ataques IDOR.
 */

export const ORG_A = {
  id: 'org-a-0000-0000-000000000001',
  name: 'Tenant A Restaurant',
  slug: 'tenant-a',
  plan: 'professional',
  stripe_customer_id: 'cus_testA',
  stripe_subscription_id: 'sub_testA',
  features: ['basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard', 'bi_dashboard', 'export_excel', 'export_pdf'],
  max_users: 15,
  max_stores: 10,
  is_active: true,
  tenant_id: 'org-a-0000-0000-000000000001',
}

export const ORG_B = {
  id: 'org-b-0000-0000-000000000002',
  name: 'Tenant B Restaurant',
  slug: 'tenant-b',
  plan: 'starter',
  stripe_customer_id: 'cus_testB',
  stripe_subscription_id: 'sub_testB',
  features: ['basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard'],
  max_users: 5,
  max_stores: 3,
  is_active: true,
  tenant_id: 'org-b-0000-0000-000000000002',
}

export const USER_A_ADMIN = {
  id: 'user-a-admin-0000-000000000001',
  email: 'admin@tenant-a.com',
  tenant_id: ORG_A.id,
  app_metadata: { org_id: ORG_A.id, org_slug: ORG_A.slug, role: 'admin', plan: ORG_A.plan, features: ORG_A.features, is_active: true },
  user_metadata: { full_name: 'Admin Tenant A' },
}

export const USER_A_MEMBER = {
  id: 'user-a-member-0000-000000000002',
  email: 'member@tenant-a.com',
  tenant_id: ORG_A.id,
  app_metadata: { org_id: ORG_A.id, org_slug: ORG_A.slug, role: 'member', plan: ORG_A.plan, features: ORG_A.features, is_active: true },
  user_metadata: { full_name: 'Member Tenant A' },
}

export const USER_B_ADMIN = {
  id: 'user-b-admin-0000-000000000003',
  email: 'admin@tenant-b.com',
  tenant_id: ORG_B.id,
  app_metadata: { org_id: ORG_B.id, org_slug: ORG_B.slug, role: 'admin', plan: ORG_B.plan, features: ORG_B.features, is_active: true },
  user_metadata: { full_name: 'Admin Tenant B' },
}

export const PLATFORM_ADMIN = {
  id: 'platform-admin-0000-000000000004',
  email: 'admin@operecheck.com.br',
  tenant_id: 'org-platform-0000-000000000000',
  app_metadata: { is_platform_admin: true, org_id: 'org-platform-0000-000000000000', role: 'owner' },
  user_metadata: { full_name: 'Platform Admin', is_platform_admin: true },
}

/** Usuario que tenta escalar privilegio via user_metadata */
export const USER_ESCALATION = {
  id: 'user-escalation-0000-000000000005',
  email: 'hacker@evil.com',
  tenant_id: ORG_A.id,
  app_metadata: { org_id: ORG_A.id, role: 'member' },
  user_metadata: { full_name: 'Hacker', is_platform_admin: true }, // Tentativa de escalacao
}
