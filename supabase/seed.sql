-- ============================================
-- OpereCheck SaaS - Seed Completo (Desenvolvimento Local)
-- ============================================
-- Cria 3 usuarios de teste para os 3 niveis:
--   1. Superadmin (plataforma) — admin@operecheck.com.br (123456) — Org "OpereCheck"
--   2. Admin (dono restaurante) — dono@restaurante.com (123456) — Org "NoCheck Restaurante"
--   3. Funcionario — func@restaurante.com (123456) — Org "NoCheck Restaurante"
--
-- 2 organizacoes:
--   - "OpereCheck" (plataforma SaaS) — enterprise, superadmin e owner
--   - "NoCheck Restaurante" (cliente) — trial 14 dias, dono e owner, func e member
--
-- NUNCA executar no banco de producao.
-- ============================================

-- 1. USUARIOS NO AUTH
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

-- 2. LIMPAR orgs/membros auto-criados pelo trigger handle_new_user
-- O trigger cria uma org para cada usuario inserido no auth.users.
-- Precisamos remover essas orgs fantasmas e manter so as nossas.
UPDATE public.users SET tenant_id = NULL WHERE tenant_id NOT IN ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');
DELETE FROM public.organization_members WHERE organization_id NOT IN ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');
DELETE FROM public.organizations WHERE id NOT IN ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001');

-- 3. ORGANIZACOES (2 orgs separadas)
-- Org da plataforma (superadmin) — enterprise, a "dona" do SaaS
INSERT INTO public.organizations (id, name, slug, plan, max_users, max_stores, features, is_active, trial_ends_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'OpereCheck', 'operecheck', 'enterprise', 999, 999,
   ARRAY['basic_orders','basic_reports','cancellations','kpi_dashboard','bi_dashboard','export_excel','export_pdf','integrations_ifood','integrations_teknisa','white_label','api_access','custom_domain','audit_logs','advanced_analytics'],
   true, NULL)
ON CONFLICT (id) DO NOTHING;

-- Org do restaurante (cliente) — trial de 14 dias, visivel em /platform
INSERT INTO public.organizations (id, name, slug, plan, max_users, max_stores, features, is_active, trial_ends_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'NoCheck Restaurante', 'nocheck', 'trial', 3, 1,
   ARRAY['basic_orders','basic_reports'],
   true, now() + interval '14 days')
ON CONFLICT (id) DO NOTHING;

-- 3. MEMBROS
-- Superadmin e owner da org OpereCheck (plataforma)
INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner', now())
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Dono e funcionario sao da org NoCheck (restaurante cliente)
INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'owner', now()),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'member', now())
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 4. ATUALIZAR USUARIOS (tenant_id correto para cada org)
UPDATE public.users SET full_name = 'Superadmin Plataforma', is_admin = true, tenant_id = 'e0000000-0000-0000-0000-000000000001' WHERE id = 'a0000000-0000-0000-0000-000000000001';
UPDATE public.users SET full_name = 'Carlos Silva (Dono)', is_admin = true, tenant_id = 'd0000000-0000-0000-0000-000000000001' WHERE id = 'b0000000-0000-0000-0000-000000000002';
UPDATE public.users SET full_name = 'Maria Santos (Funcionaria)', is_admin = false, tenant_id = 'd0000000-0000-0000-0000-000000000001' WHERE id = 'c0000000-0000-0000-0000-000000000003';

-- 5. FUNCOES (pertencem a org do restaurante)
INSERT INTO public.functions (name, description, color, icon, tenant_id) VALUES
  ('Estoquista', 'Recebimento e controle de estoque', '#10b981', 'package', 'd0000000-0000-0000-0000-000000000001'),
  ('Cozinheiro', 'Preparacao de alimentos', '#f59e0b', 'flame', 'd0000000-0000-0000-0000-000000000001'),
  ('Garcom', 'Atendimento ao cliente', '#3b82f6', 'users', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (name) DO NOTHING;

-- 6. LOJAS (pertencem a org do restaurante)
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

-- 8. USER_STORES (dono e func na org do restaurante)
INSERT INTO public.user_stores (user_id, store_id, is_primary, tenant_id) VALUES
  ('b0000000-0000-0000-0000-000000000002', 1, true, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 2, false, 'd0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 3, false, 'd0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 1, true, 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (user_id, store_id) DO NOTHING;
UPDATE public.users SET store_id = 1 WHERE id IN ('b0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000003');

-- 9. APP SETTINGS
INSERT INTO public.app_settings (key, value, description, tenant_id) VALUES
  ('ignore_time_restrictions', 'true', 'Dev: ignora restricoes de horario', 'd0000000-0000-0000-0000-000000000001'),
  ('ignore_time_restrictions_stores', 'all', 'Bypass para todas as lojas', 'd0000000-0000-0000-0000-000000000001')
ON CONFLICT (key) DO NOTHING;

-- 10. TEMPLATE DE EXEMPLO (org do restaurante)
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

-- 11. PRICING CONFIGS (planos dinamicos)
INSERT INTO pricing_configs (id, name, price_brl, max_users, max_stores, features, stripe_price_id, sort_order) VALUES
  ('trial',        'Trial',        0,   3,   1,   '{"basic_orders","basic_reports"}', '', 0),
  ('starter',      'Starter',      297, 5,   3,   '{"basic_orders","basic_reports","cancellations","kpi_dashboard"}', 'price_1TC1hW2FHw3Dg8PTnfIwKE4C', 1),
  ('professional', 'Professional', 597, 15,  10,  '{"basic_orders","basic_reports","cancellations","kpi_dashboard","bi_dashboard","export_excel","export_pdf","integrations_ifood","integrations_teknisa"}', 'price_1TC1hW2FHw3Dg8PT5yc0BWz8', 2),
  ('enterprise',   'Enterprise',   997, 999, 999, '{"basic_orders","basic_reports","cancellations","kpi_dashboard","bi_dashboard","export_excel","export_pdf","integrations_ifood","integrations_teknisa","white_label","api_access","custom_domain","audit_logs","advanced_analytics"}', 'price_1TC1hX2FHw3Dg8PTCTHGGNZH', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USUARIOS DE TESTE
-- | Email                    | Senha  | Nivel              | Org                  |
-- |--------------------------|--------|--------------------|----------------------|
-- | admin@operecheck.com.br  | 123456 | Superadmin (plat.) | OpereCheck           |
-- | dono@restaurante.com     | 123456 | Admin (dono)       | NoCheck Restaurante  |
-- | func@restaurante.com     | 123456 | Funcionario        | NoCheck Restaurante  |
-- ============================================
