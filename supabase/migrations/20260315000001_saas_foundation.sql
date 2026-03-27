-- ============================================
-- MIGRATION 001: SaaS Foundation
-- Multi-tenant tables + RLS + Auth hooks
-- Executa em CIMA do schema base existente
-- ============================================

-- ── 1. ORGANIZATIONS (Tenants) ──
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial'
    CHECK (plan IN ('trial', 'starter', 'professional', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{
    "theme": {
      "primaryColor": "#264653",
      "logoUrl": null,
      "faviconUrl": null,
      "appName": "Sistema"
    },
    "customDomain": null,
    "emailFrom": null
  }'::jsonb,
  max_users INT DEFAULT 5,
  max_stores INT DEFAULT 3,
  features TEXT[] DEFAULT '{"basic_orders","basic_reports"}',
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON organizations(stripe_customer_id);

-- ── 2. ORGANIZATION MEMBERS ──
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_email TEXT,
  invite_token UUID DEFAULT gen_random_uuid(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_token ON organization_members(invite_token);

-- ── 3. INVITES ──
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);

-- ── 4. AUDIT LOGS ──
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ── 5. TENANT INTEGRATIONS ──
CREATE TABLE IF NOT EXISTS public.tenant_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
    CHECK (provider IN ('ifood', 'teknisa', 'whatsapp', 'smtp', 'webhook')),
  store_id INTEGER REFERENCES stores(id),
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider, store_id)
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON tenant_integrations(tenant_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Retorna o org_id do JWT do usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID,
    (SELECT om.organization_id
     FROM organization_members om
     WHERE om.user_id = auth.uid()
     LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retorna o role do usuario na org atual
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT om.role
     FROM organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = get_current_org_id()
     LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Verifica se o usuario tem permissao minima
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT CASE get_current_role()
    WHEN 'owner' THEN true
    WHEN 'admin' THEN required_role IN ('admin', 'manager', 'member', 'viewer')
    WHEN 'manager' THEN required_role IN ('manager', 'member', 'viewer')
    WHEN 'member' THEN required_role IN ('member', 'viewer')
    WHEN 'viewer' THEN required_role = 'viewer'
    ELSE false
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger generico de audit log
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, changes)
  VALUES (
    COALESCE(NEW.tenant_id, OLD.tenant_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::UUID,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
      'after', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (tabelas novas)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_select ON organizations FOR SELECT
  USING (id = get_current_org_id());
CREATE POLICY org_update ON organizations FOR UPDATE
  USING (id = get_current_org_id() AND has_role('admin'));

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_members_select ON organization_members FOR SELECT
  USING (organization_id = get_current_org_id());
CREATE POLICY org_members_insert ON organization_members FOR INSERT
  WITH CHECK (organization_id = get_current_org_id() AND has_role('admin'));
CREATE POLICY org_members_update ON organization_members FOR UPDATE
  USING (organization_id = get_current_org_id() AND has_role('admin'));
CREATE POLICY org_members_delete ON organization_members FOR DELETE
  USING (organization_id = get_current_org_id() AND has_role('admin'));

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_select ON invites FOR SELECT
  USING (tenant_id = get_current_org_id());
CREATE POLICY invites_manage ON invites FOR ALL
  USING (tenant_id = get_current_org_id() AND has_role('admin'));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON audit_logs FOR SELECT
  USING (tenant_id = get_current_org_id() AND has_role('admin'));

ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrations_select ON tenant_integrations FOR SELECT
  USING (tenant_id = get_current_org_id());
CREATE POLICY integrations_manage ON tenant_integrations FOR ALL
  USING (tenant_id = get_current_org_id() AND has_role('admin'));

-- ============================================
-- TRIGGERS (tabelas novas)
-- ============================================

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- AUTH HOOK: Enriquece JWT com dados do tenant
-- ============================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  org_record RECORD;
BEGIN
  claims := event -> 'claims';

  SELECT o.id AS org_id, o.slug, o.plan, om.role, o.features, o.is_active
  INTO org_record
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = (event ->> 'user_id')::UUID
    AND om.accepted_at IS NOT NULL
  ORDER BY om.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    claims := jsonb_set(claims, '{app_metadata,org_id}', to_jsonb(org_record.org_id::TEXT));
    claims := jsonb_set(claims, '{app_metadata,org_slug}', to_jsonb(org_record.slug));
    claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(org_record.role));
    claims := jsonb_set(claims, '{app_metadata,plan}', to_jsonb(org_record.plan));
    claims := jsonb_set(claims, '{app_metadata,features}', to_jsonb(org_record.features));
    claims := jsonb_set(claims, '{app_metadata,is_active}', to_jsonb(org_record.is_active));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Permissao para supabase_auth_admin chamar o hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.organizations TO supabase_auth_admin;
GRANT SELECT ON public.organization_members TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================
-- SUBSTITUIR handle_new_user para auto-criar org no signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  user_name TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Criar usuario na tabela public.users
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_name);

  -- Criar organizacao automaticamente
  INSERT INTO organizations (name, slug)
  VALUES (
    user_name || '''s Organization',
    lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 8)
  )
  RETURNING id INTO new_org_id;

  -- Vincular como owner
  INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
