-- ============================================
-- OpereCheck SaaS - Seed Completo (Desenvolvimento Local)
-- ============================================
-- Cria 3 usuarios de teste para os 3 niveis:
--   1. Superadmin — admin@operecheck.com.br (123456)
--   2. Admin (dono) — dono@restaurante.com (123456)
--   3. Funcionario — func@restaurante.com (123456)
-- Cria org, lojas, setores, funcoes, template, visibility.
-- NUNCA executar no banco de producao.
-- ============================================

-- 1. USUARIOS NO AUTH
-- O trigger handle_new_user dispara e cria user+org automaticamente.
-- Depois corrigimos os dados via UPDATE.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, aud, role,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token,
  created_at, updated_at
) VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'admin@operecheck.com.br', crypt('123456', gen_salt('bf')), now(),
   '{"full_name":"Superadmin Plataforma","is_platform_admin":true}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   'authenticated', 'authenticated',
   '', '', '', '', '', '', '', '',
   now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'dono@restaurante.com', crypt('123456', gen_salt('bf')), now(),
   '{"full_name":"Carlos Silva (Dono)"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   'authenticated', 'authenticated',
   '', '', '', '', '', '', '', '',
   now(), now()),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'func@restaurante.com', crypt('123456', gen_salt('bf')), now(),
   '{"full_name":"Maria Santos (Funcionaria)"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb,
   'authenticated', 'authenticated',
   '', '', '', '', '', '', '', '',
   now(), now())
ON CONFLICT (id) DO NOTHING;

-- Identidades (necessario para login)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
  (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@operecheck.com.br"}'::jsonb, 'email', 'a0000000-0000-0000-0000-000000000001', now(), now(), now()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002', '{"sub":"b0000000-0000-0000-0000-000000000002","email":"dono@restaurante.com"}'::jsonb, 'email', 'b0000000-0000-0000-0000-000000000002', now(), now(), now()),
  (gen_random_uuid(), 'c0000000-0000-0000-0000-000000000003', '{"sub":"c0000000-0000-0000-0000-000000000003","email":"func@restaurante.com"}'::jsonb, 'email', 'c0000000-0000-0000-0000-000000000003', now(), now(), now())
ON CONFLICT DO NOTHING;

-- 2. ORGANIZACAO
INSERT INTO public.organizations (id, name, slug, plan, max_users, max_stores, features, is_active, trial_ends_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'OpereCheck', 'operecheck', 'enterprise', 999, 999,
   ARRAY['basic_orders','basic_reports','cancellations','kpi_dashboard','bi_dashboard','export_excel','export_pdf','integrations_ifood','integrations_teknisa','white_label','api_access','custom_domain','audit_logs','advanced_analytics'],
   true, NULL)
ON CONFLICT (id) DO NOTHING;

-- 3. MEMBROS (handle_new_user trigger ja cria orgs auto — vamos linkar a org real)
INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner', now()),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'admin', now()),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'member', now())
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. ATUALIZAR USUARIOS (trigger handle_new_user criou com defaults, corrigimos)
UPDATE public.users SET full_name = 'Superadmin Plataforma', is_admin = true, tenant_id = 'd0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.users SET full_name = 'Carlos Silva (Dono)', is_admin = true, tenant_id = 'd0000000-0000-0000-0000-000000000001' WHERE id = 'b0000000-0000-0000-0000-000000000002';
UPDATE public.users SET full_name = 'Maria Santos (Funcionaria)', is_admin = false, tenant_id = 'd0000000-0000-0000-0000-000000000001' WHERE id = 'c0000000-0000-0000-0000-000000000003';

-- 5. FUNCOES
INSERT INTO public.functions (name, description, color, icon, tenant_id) VALUES
  ('Estoquista', 'Recebimento e controle de estoque', '#10b981', 'package', 'd0000000-0000-0000-0000-000000000001'),
  ('Cozinheiro', 'Preparacao de alimentos', '#f59e0b', 'flame', 'd0000000-0000-0000-0000-000000000001'),
  ('Garcom', 'Atendimento ao cliente', '#3b82f6', 'users', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (name) DO NOTHING;

-- 6. LOJAS
INSERT INTO public.stores (id, name, address, is_active, require_gps, tenant_id) VALUES
  (1, 'BDN Boa Viagem', 'Recife-PE', true, false, 'd0000000-0000-0000-0000-000000000001'),
  (2, 'BDN Guararapes', 'Recife-PE', true, false, 'd0000000-0000-0000-0000-000000000001'),
  (3, 'BDN Afogados', 'Recife-PE', true, false, 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;
SELECT setval('stores_id_seq', 3);

-- 7. SETORES
INSERT INTO public.sectors (store_id, name, color, is_active, tenant_id) VALUES
  (1, 'Cozinha', '#ef4444', true, 'd0000000-0000-0000-0000-000000000001'),
  (1, 'Salao', '#3b82f6', true, 'd0000000-0000-0000-0000-000000000001'),
  (2, 'Cozinha', '#ef4444', true, 'd0000000-0000-0000-0000-000000000001'),
  (3, 'Cozinha', '#ef4444', true, 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (store_id, name) DO NOTHING;

-- 8. USER_STORES
INSERT INTO public.user_stores (user_id, store_id, is_primary, tenant_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 1, true, 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 2, false, 'd0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 3, false, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 1, true, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 2, false, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 3, false, 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 1, true, 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, store_id) DO NOTHING;
UPDATE public.users SET store_id = 1 WHERE id IN ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003');

-- 9. APP SETTINGS
INSERT INTO public.app_settings (key, value, description, tenant_id) VALUES
  ('ignore_time_restrictions', 'true', 'Dev: ignora restricoes de horario', 'd0000000-0000-0000-0000-000000000001'),
  ('ignore_time_restrictions_stores', 'all', 'Bypass para todas as lojas', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (key) DO NOTHING;

-- 10. TEMPLATE DE EXEMPLO
DO $$
DECLARE v_tid INTEGER; v_s1 BIGINT; v_s2 BIGINT;
BEGIN
  INSERT INTO checklist_templates (name, description, category, is_active, tenant_id)
  VALUES ('Checklist de Abertura', 'Checklist diario de abertura', 'abertura', true, 'd0000000-0000-0000-0000-000000000001')
  RETURNING id INTO v_tid;

  INSERT INTO template_sections (template_id, name, sort_order, tenant_id)
  VALUES (v_tid, 'Verificacoes', 1, 'd0000000-0000-0000-0000-000000000001') RETURNING id INTO v_s1;
  INSERT INTO template_sections (template_id, name, sort_order, tenant_id)
  VALUES (v_tid, 'Equipamentos', 2, 'd0000000-0000-0000-0000-000000000001') RETURNING id INTO v_s2;

  INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order, tenant_id) VALUES
    (v_tid, v_s1, 'Loja limpa?', 'yes_no', true, 1, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, v_s1, 'Uniformes OK?', 'yes_no', true, 2, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, v_s1, 'Observacoes', 'text', false, 3, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, v_s2, 'Geladeira OK?', 'yes_no', true, 4, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, v_s2, 'Foto painel', 'photo', false, 5, 'd0000000-0000-0000-0000-000000000001');

  INSERT INTO template_visibility (template_id, store_id, tenant_id) VALUES
    (v_tid, 1, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, 2, 'd0000000-0000-0000-0000-000000000001'),
    (v_tid, 3, 'd0000000-0000-0000-0000-000000000001');
END $$;

-- ============================================
-- USUARIOS DE TESTE
-- | Email                    | Senha  | Nivel        | Role na Org |
-- |--------------------------|--------|--------------|-------------|
-- | admin@operecheck.com.br  | 123456 | Superadmin   | owner       |
-- | dono@restaurante.com     | 123456 | Admin (dono) | admin       |
-- | func@restaurante.com     | 123456 | Funcionario  | member      |
-- ============================================
