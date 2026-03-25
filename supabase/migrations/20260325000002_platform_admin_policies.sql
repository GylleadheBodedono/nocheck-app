-- ============================================
-- Platform Admin: permitir superadmin ver TODAS as orgs
-- Necessario para /platform dashboard funcionar
-- ============================================

-- Superadmin pode ver todas as organizacoes (para o painel /platform)
CREATE POLICY "org_select_platform_admin" ON public.organizations
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

-- Superadmin pode ver todos os usuarios (para contagens e detalhes em /platform)
CREATE POLICY "users_select_platform_admin" ON public.users
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

-- Superadmin pode ver todas as lojas (para contagens em /platform)
CREATE POLICY "stores_select_platform_admin" ON public.stores
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

-- Superadmin pode ver todos os organization_members (para detalhes de clientes)
CREATE POLICY "org_members_select_platform_admin" ON public.organization_members
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );
