-- ============================================
-- FIX: handle_new_user deve setar tenant_id no user
-- e usar defaults corretos de trial (max_users=3, max_stores=1)
-- IMPORTANTE: usar public.* em todas as tabelas pois o GoTrue
-- executa triggers com search_path diferente.
-- ============================================

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

  -- Criar usuario na tabela public.users
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, user_name);

  -- Nao criar org para platform admins (eles gerenciam todas as orgs)
  IF (NEW.raw_user_meta_data ->> 'is_platform_admin')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Gerar slug unico
  org_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  -- Criar organizacao com defaults de trial
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

  -- Vincular como owner
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  -- Setar tenant_id no usuario
  UPDATE public.users SET tenant_id = new_org_id WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Garantir que supabase_auth_admin pode executar o trigger e acessar as tabelas
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.users TO supabase_auth_admin;
GRANT INSERT, SELECT ON public.organizations TO supabase_auth_admin;
GRANT INSERT ON public.organization_members TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
