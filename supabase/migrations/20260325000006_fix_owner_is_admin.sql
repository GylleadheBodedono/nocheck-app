-- Fix: dono da org (owner) deve ser is_admin = true
-- O trigger handle_new_user criava o user mas nao setava is_admin

-- Fix retroativo para owners existentes
UPDATE public.users u SET is_admin = true
FROM organization_members om
WHERE om.user_id = u.id AND om.role = 'owner' AND u.is_admin = false;

-- Recriar trigger com is_admin = true para o criador
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  user_name TEXT;
  org_slug TEXT;
  company_name TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company_name',
    user_name
  );

  -- Criar usuario na tabela public.users (dono = is_admin)
  INSERT INTO public.users (id, email, full_name, is_admin)
  VALUES (NEW.id, NEW.email, user_name, true);

  -- Nao criar org para platform admins
  IF (NEW.raw_user_meta_data ->> 'is_platform_admin')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Gerar slug unico
  org_slug := lower(regexp_replace(company_name, '[^a-zA-Z0-9]', '-', 'g'));
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  -- Criar organizacao com defaults de trial
  INSERT INTO public.organizations (name, slug, plan, max_users, max_stores, features, trial_ends_at)
  VALUES (
    company_name,
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

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user TO supabase_auth_admin;
GRANT INSERT, UPDATE ON public.users TO supabase_auth_admin;
GRANT INSERT, SELECT ON public.organizations TO supabase_auth_admin;
GRANT INSERT ON public.organization_members TO supabase_auth_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
