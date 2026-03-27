-- ============================================
-- FIX: Create missing org tables + deploy custom_access_token_hook
-- Root cause: organizations and organization_members tables were never created
-- despite being in migration records. The auth hook is registered but the
-- function didn't exist, causing "database error querying schema" on every login.
-- ============================================

-- ── Step 1: Create ORGANIZATIONS table (must be first) ──
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
      "primaryColor": "#0D9488",
      "logoUrl": null,
      "faviconUrl": null,
      "appName": "OpereCheck"
    },
    "customDomain": null,
    "emailFrom": null
  }'::jsonb,
  max_users INT DEFAULT 5,
  max_stores INT DEFAULT 3,
  features TEXT[] DEFAULT '{"basic_orders","basic_reports"}',
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),
  pending_plan TEXT DEFAULT NULL,
  previous_plan TEXT DEFAULT NULL,
  current_period_end TIMESTAMPTZ DEFAULT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  business_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON public.organizations(stripe_customer_id);

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Step 2: Create ORGANIZATION_MEMBERS table ──
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_token ON public.organization_members(invite_token);

-- ── Step 3: Helper functions (tables must exist first for SQL-language functions) ──

CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID,
    (SELECT om.organization_id
     FROM public.organization_members om
     WHERE om.user_id = auth.uid()
     LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT om.role
     FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = get_current_org_id()
     LIMIT 1)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

-- ── Step 4: RLS for organizations ──
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations FOR SELECT
  USING (id = get_current_org_id());

DROP POLICY IF EXISTS org_update ON public.organizations;
CREATE POLICY org_update ON public.organizations FOR UPDATE
  USING (id = get_current_org_id() AND has_role('admin'));

DROP POLICY IF EXISTS "org_select_platform_admin" ON public.organizations;
CREATE POLICY "org_select_platform_admin" ON public.organizations
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

-- ── Step 5: RLS for organization_members ──
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members FOR SELECT
  USING (organization_id = get_current_org_id());

DROP POLICY IF EXISTS org_members_insert ON public.organization_members;
CREATE POLICY org_members_insert ON public.organization_members FOR INSERT
  WITH CHECK (organization_id = get_current_org_id() AND has_role('admin'));

DROP POLICY IF EXISTS org_members_update ON public.organization_members;
CREATE POLICY org_members_update ON public.organization_members FOR UPDATE
  USING (organization_id = get_current_org_id() AND has_role('admin'));

DROP POLICY IF EXISTS org_members_delete ON public.organization_members;
CREATE POLICY org_members_delete ON public.organization_members FOR DELETE
  USING (organization_id = get_current_org_id() AND has_role('admin'));

DROP POLICY IF EXISTS "org_members_select_platform_admin" ON public.organization_members;
CREATE POLICY "org_members_select_platform_admin" ON public.organization_members
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

-- ── Step 6: Update handle_new_user to auto-create org for new users ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  user_name TEXT;
  org_slug TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, full_name, phone)
  VALUES (NEW.id, NEW.email, user_name, NEW.raw_user_meta_data ->> 'phone')
  ON CONFLICT (id) DO NOTHING;

  -- Platform admins don't get their own org
  IF (NEW.raw_user_meta_data ->> 'is_platform_admin')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Generate unique org slug
  org_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.organizations (name, slug, plan, max_users, max_stores, features, trial_ends_at)
  VALUES (
    user_name,
    org_slug,
    'trial',
    3,
    1,
    ARRAY['basic_orders','basic_reports'],
    now() + interval '14 days'
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grants for supabase_auth_admin (needed for handle_new_user trigger)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.users TO supabase_auth_admin;
GRANT INSERT, SELECT ON public.organizations TO supabase_auth_admin;
GRANT INSERT ON public.organization_members TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- ── Step 7: Deploy custom_access_token_hook ──
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  org_record RECORD;
  is_platform BOOLEAN;
BEGIN
  claims := event -> 'claims';

  SELECT COALESCE((raw_user_meta_data ->> 'is_platform_admin')::boolean, false)
  INTO is_platform
  FROM auth.users
  WHERE id = (event ->> 'user_id')::UUID;

  IF is_platform IS TRUE THEN
    claims := jsonb_set(claims, '{app_metadata,is_platform_admin}', 'true'::jsonb);
  END IF;

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

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.organization_members TO supabase_auth_admin;
GRANT SELECT ON public.organizations TO supabase_auth_admin;
GRANT SELECT ON auth.users TO supabase_auth_admin;
