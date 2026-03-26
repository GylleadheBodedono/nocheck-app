-- Fix: auth hook deve injetar is_platform_admin no app_metadata do JWT
-- Sem isso, as RLS policies que checam app_metadata.is_platform_admin nao funcionam

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  org_record RECORD;
  is_platform BOOLEAN;
BEGIN
  claims := event -> 'claims';

  -- Verificar se e platform admin (via user_metadata)
  SELECT COALESCE((raw_user_meta_data ->> 'is_platform_admin')::boolean, false)
  INTO is_platform
  FROM auth.users
  WHERE id = (event ->> 'user_id')::UUID;

  IF is_platform IS TRUE THEN
    claims := jsonb_set(claims, '{app_metadata,is_platform_admin}', 'true'::jsonb);
  END IF;

  -- Buscar dados da org do usuario
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
GRANT SELECT ON auth.users TO supabase_auth_admin;
