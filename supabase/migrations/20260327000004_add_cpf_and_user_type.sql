-- Add CPF and user_type fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'empresa'
    CHECK (user_type IN ('empresa', 'funcionario'));

-- Update handle_new_user to propagate cpf and user_type from auth metadata
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

  INSERT INTO public.users (id, email, full_name, phone, cpf, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'cpf',
    COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'empresa')
  )
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
