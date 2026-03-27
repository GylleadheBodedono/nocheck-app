-- Fix: policies de platform admin devem checar app_metadata (onde o auth hook injeta)
-- em vez de user_metadata (que nao esta disponivel em request.jwt.claims)

DROP POLICY IF EXISTS "org_select_platform_admin" ON public.organizations;
CREATE POLICY "org_select_platform_admin" ON public.organizations
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

DROP POLICY IF EXISTS "users_select_platform_admin" ON public.users;
CREATE POLICY "users_select_platform_admin" ON public.users
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

DROP POLICY IF EXISTS "stores_select_platform_admin" ON public.stores;
CREATE POLICY "stores_select_platform_admin" ON public.stores
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

DROP POLICY IF EXISTS "org_members_select_platform_admin" ON public.organization_members;
CREATE POLICY "org_members_select_platform_admin" ON public.organization_members
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );
