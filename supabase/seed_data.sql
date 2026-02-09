-- ============================================
-- SEED DATA v3.0 - Novo modelo de permissões
-- Execute no Supabase SQL Editor
-- ============================================
-- Pré-requisitos: migrations 001 a 008 já executadas
--
-- Modelo:
--   users.store_id    → loja do usuário
--   users.function_id → função (estoquista, cozinheiro, etc.)
--   users.sector_id   → setor (cozinha, estoque, etc.)
--   users.is_manager  → gerente (vê tudo da loja, não preenche)
--   users.is_admin    → admin (vê tudo)
--
-- template_visibility: store_id + sector_id + function_id
--   NULL em sector_id = todos os setores da loja
--   NULL em function_id = todas as funções
-- ============================================

-- ============================================
-- 1. CONFIGURE SEU USUARIO COMO ADMIN
-- Substitua 'admin@nocheck.com' pelo seu email
-- ============================================
DO $$
DECLARE
  user_email TEXT := 'admin@nocheck.com'; -- ALTERE PARA SEU EMAIL
  user_uuid UUID;
BEGIN
  SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;

  IF user_uuid IS NULL THEN
    RAISE NOTICE 'Usuario com email % nao encontrado no auth.users', user_email;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_uuid) THEN
    INSERT INTO public.users (id, email, full_name, is_admin, is_active)
    VALUES (user_uuid, user_email, 'Administrador', true, true);
    RAISE NOTICE 'Usuario criado como admin';
  ELSE
    UPDATE public.users
    SET is_admin = true, full_name = COALESCE(NULLIF(full_name, ''), 'Administrador')
    WHERE id = user_uuid;
    RAISE NOTICE 'Usuario atualizado para admin';
  END IF;
END $$;

-- ============================================
-- 2. CRIAR AS 8 LOJAS DO GRUPO DO NÔ
-- ============================================
INSERT INTO public.stores (id, name) VALUES
  (1, 'BDN Boa Viagem'),
  (2, 'BDN Guararapes'),
  (3, 'BDN Afogados'),
  (4, 'BDN Tacaruna'),
  (5, 'BDN Olinda'),
  (6, 'BRG Boa Viagem'),
  (7, 'BRG Riomar'),
  (8, 'BRG Guararapes')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- ============================================
-- 3. FUNÇÕES (já criadas na migration 008, garante que existam)
-- ============================================
INSERT INTO public.functions (name, description, color, icon) VALUES
  ('Estoquista', 'Recebimento e controle de estoque', '#10b981', 'package'),
  ('Cozinheiro', 'Preparação de alimentos e higiene', '#f59e0b', 'flame'),
  ('Zelador', 'Limpeza e manutenção geral', '#8b5cf6', 'sparkles'),
  ('Garçom', 'Atendimento ao cliente no salão', '#3b82f6', 'users'),
  ('Aprendiz', 'Funcionário em treinamento', '#f97316', 'book-open')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. SETORES PADRÃO POR LOJA
-- Cada loja ganha: Cozinha, Estoque, Salão
-- ============================================
DO $$
DECLARE
  store_rec RECORD;
BEGIN
  FOR store_rec IN SELECT id FROM public.stores WHERE is_active = true
  LOOP
    INSERT INTO public.sectors (name, store_id, color, icon)
    VALUES
      ('Cozinha', store_rec.id, '#f59e0b', 'flame'),
      ('Estoque', store_rec.id, '#10b981', 'package'),
      ('Salão', store_rec.id, '#3b82f6', 'users')
    ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE 'Setores criados para todas as lojas';
END $$;

-- ============================================
-- 5. TEMPLATES DE CHECKLIST
-- ============================================
INSERT INTO public.checklist_templates (id, name, description, category)
VALUES
  (1, 'Recebimento - Estoquista', 'Checklist para recebimento de mercadorias pelo estoquista', 'recebimento'),
  (2, 'Recebimento - Aprendiz', 'Checklist para lançamento no Teknisa pelo aprendiz', 'recebimento'),
  (3, 'Abertura de Loja', 'Checklist diário de abertura da loja', 'abertura'),
  (4, 'Fechamento de Loja', 'Checklist diário de fechamento da loja', 'fechamento')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================
-- 6. CAMPOS DOS TEMPLATES
-- ============================================

-- Limpa campos existentes para evitar duplicatas
DELETE FROM public.template_fields WHERE template_id IN (1, 2, 3, 4);

-- Campos do Template 1: Recebimento - Estoquista
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(1, 'Fornecedor', 'dropdown', true, 1, '["Ambev", "Coca-Cola", "JBS", "BRF", "Nestle", "Unilever", "PepsiCo", "Heineken", "Outros"]', NULL, 'Selecione o fornecedor'),
(1, 'Numero da Nota Fiscal', 'text', true, 2, NULL, 'Ex: 123456', 'Digite o numero da NF'),
(1, 'Valor Total da Nota', 'number', true, 3, NULL, '0.00', 'Valor total em reais'),
(1, 'Foto da Nota Fiscal', 'photo', true, 4, '{"maxPhotos": 3}', NULL, 'Tire foto clara da NF'),
(1, 'Produtos conferidos?', 'yes_no', true, 5, NULL, NULL, 'Todos os produtos foram conferidos?'),
(1, 'Observacoes', 'text', false, 6, NULL, 'Observacoes opcionais...', NULL),
(1, 'Localizacao GPS', 'gps', false, 7, NULL, NULL, 'Capture sua localizacao'),
(1, 'Assinatura', 'signature', true, 8, NULL, NULL, 'Assine para confirmar');

-- Campos do Template 2: Recebimento - Aprendiz
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, placeholder, help_text) VALUES
(2, 'Numero da Nota Fiscal', 'text', true, 1, 'Ex: 123456', 'MESMO numero que o estoquista'),
(2, 'Numero do Lancamento Teknisa', 'text', true, 2, 'Ex: TK-789012', 'Codigo gerado no Teknisa'),
(2, 'Valor Lancado', 'number', true, 3, '0.00', 'Valor que voce lancou'),
(2, 'Lancamento correto?', 'yes_no', true, 4, NULL, 'O lancamento confere com a nota?'),
(2, 'Observacoes', 'text', false, 5, 'Observacoes opcionais...', NULL),
(2, 'Assinatura', 'signature', true, 6, NULL, 'Assine para confirmar');

-- Campos do Template 3: Abertura de Loja
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(3, 'Horario de Chegada', 'datetime', true, 1, NULL, NULL, 'Registre seu horario de chegada'),
(3, 'Loja estava limpa?', 'yes_no', true, 2, NULL, NULL, 'A loja estava limpa ao chegar?'),
(3, 'Equipamentos funcionando?', 'checkbox_multiple', true, 3, '["Geladeiras", "Freezers", "Ar condicionado", "Luzes", "Caixas registradoras"]', NULL, 'Marque os que estao funcionando'),
(3, 'Foto da fachada', 'photo', true, 4, '{"maxPhotos": 1}', NULL, 'Foto da entrada da loja'),
(3, 'Localizacao GPS', 'gps', false, 5, NULL, NULL, 'Capture sua localizacao'),
(3, 'Observacoes da abertura', 'text', false, 6, NULL, 'Algo a reportar?', NULL);

-- Campos do Template 4: Fechamento de Loja
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(4, 'Horario de Fechamento', 'datetime', true, 1, NULL, NULL, 'Registre o horario de fechamento'),
(4, 'Caixa conferido?', 'yes_no', true, 2, NULL, NULL, 'Os valores do caixa batem?'),
(4, 'Valor em caixa', 'number', true, 3, NULL, '0.00', 'Total em dinheiro'),
(4, 'Loja foi limpa?', 'yes_no', true, 4, NULL, NULL, 'A limpeza foi realizada?'),
(4, 'Equipamentos desligados?', 'checkbox_multiple', true, 5, '["Luzes internas", "Ar condicionado", "Computadores", "Letreiro"]', NULL, 'Marque os que foram desligados'),
(4, 'Foto do fechamento', 'photo', false, 6, '{"maxPhotos": 2}', NULL, 'Foto opcional'),
(4, 'Assinatura do responsavel', 'signature', true, 7, NULL, NULL, 'Assine para confirmar fechamento');

-- ============================================
-- 7. VISIBILIDADE DOS TEMPLATES
-- Novo modelo: store_id + sector_id + function_id
-- NULL = todos (ex: function_id NULL = todas as funções)
-- ============================================

-- Limpa visibilidade existente
DELETE FROM public.template_visibility WHERE template_id IN (1, 2, 3, 4);

-- Template 1: Recebimento Estoquista → todas as lojas, setor Estoque, função Estoquista
INSERT INTO public.template_visibility (template_id, store_id, sector_id, function_id, roles)
SELECT
  1,
  s.id,
  sec.id,
  f.id,
  ARRAY[]::text[]
FROM public.stores s
CROSS JOIN public.sectors sec ON sec.store_id = s.id AND sec.name = 'Estoque'
CROSS JOIN public.functions f ON f.name = 'Estoquista'
WHERE s.is_active = true;

-- Template 2: Recebimento Aprendiz → todas as lojas, setor Estoque, função Aprendiz
INSERT INTO public.template_visibility (template_id, store_id, sector_id, function_id, roles)
SELECT
  2,
  s.id,
  sec.id,
  f.id,
  ARRAY[]::text[]
FROM public.stores s
CROSS JOIN public.sectors sec ON sec.store_id = s.id AND sec.name = 'Estoque'
CROSS JOIN public.functions f ON f.name = 'Aprendiz'
WHERE s.is_active = true;

-- Template 3: Abertura de Loja → todas as lojas, todos os setores, todas as funções
INSERT INTO public.template_visibility (template_id, store_id, sector_id, function_id, roles)
SELECT
  3,
  s.id,
  NULL,
  NULL,
  ARRAY[]::text[]
FROM public.stores s
WHERE s.is_active = true;

-- Template 4: Fechamento de Loja → todas as lojas, todos os setores, todas as funções
INSERT INTO public.template_visibility (template_id, store_id, sector_id, function_id, roles)
SELECT
  4,
  s.id,
  NULL,
  NULL,
  ARRAY[]::text[]
FROM public.stores s
WHERE s.is_active = true;

-- ============================================
-- 8. VERIFICAÇÃO FINAL
-- ============================================
SELECT 'Lojas' as tipo, COUNT(*) as total FROM public.stores WHERE is_active = true
UNION ALL
SELECT 'Funções', COUNT(*) FROM public.functions WHERE is_active = true
UNION ALL
SELECT 'Setores', COUNT(*) FROM public.sectors WHERE is_active = true
UNION ALL
SELECT 'Templates', COUNT(*) FROM public.checklist_templates WHERE is_active = true
UNION ALL
SELECT 'Campos', COUNT(*) FROM public.template_fields WHERE template_id IN (1,2,3,4)
UNION ALL
SELECT 'Visibilidades', COUNT(*) FROM public.template_visibility WHERE template_id IN (1,2,3,4)
UNION ALL
SELECT 'Usuários', COUNT(*) FROM public.users
UNION ALL
SELECT 'Admins', COUNT(*) FROM public.users WHERE is_admin = true
UNION ALL
SELECT 'Gerentes', COUNT(*) FROM public.users WHERE is_manager = true;
