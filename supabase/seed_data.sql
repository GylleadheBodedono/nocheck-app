-- ============================================
-- SEED DATA - Execute no Supabase SQL Editor
-- ============================================

-- 1. PRIMEIRO: Verifique se as tabelas e dados base existem
-- Se não existir, execute primeiro o arquivo 001_initial_schema.sql

-- 2. CONFIGURE SEU USUARIO COMO ADMIN
-- Substitua 'SEU_EMAIL_AQUI' pelo email que você usa para logar
-- ============================================

DO $$
DECLARE
  user_email TEXT := 'admin@nocheck.com'; -- ALTERE PARA SEU EMAIL
  user_uuid UUID;
BEGIN
  -- Busca o ID do usuário pelo email
  SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;

  IF user_uuid IS NULL THEN
    RAISE NOTICE 'Usuario com email % nao encontrado no auth.users', user_email;
    RETURN;
  END IF;

  -- Verifica se já existe na tabela users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = user_uuid) THEN
    INSERT INTO public.users (id, email, full_name, is_admin, is_active)
    VALUES (user_uuid, user_email, 'Administrador', true, true);
    RAISE NOTICE 'Usuario criado na tabela users';
  ELSE
    -- Atualiza para admin
    UPDATE public.users
    SET is_admin = true, full_name = COALESCE(full_name, 'Administrador')
    WHERE id = user_uuid;
    RAISE NOTICE 'Usuario atualizado para admin';
  END IF;

  -- Atribui role de gerente em todas as lojas (admin tem acesso total)
  INSERT INTO public.user_store_roles (user_id, store_id, role)
  SELECT user_uuid, s.id, 'gerente'
  FROM public.stores s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_store_roles
    WHERE user_id = user_uuid AND store_id = s.id AND role = 'gerente'
  );

  RAISE NOTICE 'Roles atribuidas com sucesso!';
END $$;

-- ============================================
-- 3. CRIAR AS 8 LOJAS DO GRUPO DO NÔ
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
-- 4. VERIFICAR SE OS TEMPLATES EXISTEM
-- ============================================

-- Template: Recebimento - Estoquista
INSERT INTO public.checklist_templates (id, name, description, category)
VALUES (1, 'Recebimento - Estoquista', 'Checklist para recebimento de mercadorias pelo estoquista', 'recebimento')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Template: Recebimento - Aprendiz
INSERT INTO public.checklist_templates (id, name, description, category)
VALUES (2, 'Recebimento - Aprendiz', 'Checklist para lançamento no Teknisa pelo aprendiz', 'recebimento')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Template: Abertura de Loja
INSERT INTO public.checklist_templates (id, name, description, category)
VALUES (3, 'Abertura de Loja', 'Checklist diario de abertura da loja', 'abertura')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Template: Fechamento de Loja
INSERT INTO public.checklist_templates (id, name, description, category)
VALUES (4, 'Fechamento de Loja', 'Checklist diario de fechamento da loja', 'fechamento')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================
-- 5. CAMPOS DOS TEMPLATES
-- ============================================

-- Limpa campos existentes para evitar duplicatas
DELETE FROM public.template_fields WHERE template_id IN (1, 2, 3, 4);

-- Campos do Template 1: Recebimento - Estoquista
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(1, 'Fornecedor', 'dropdown', true, 1, '["Ambev", "Coca-Cola", "JBS", "BRF", "Nestle", "Unilever", "PepsiCo", "Heineken", "Outros"]', NULL, 'Selecione o fornecedor'),
(1, 'Numero da Nota Fiscal', 'text', true, 2, NULL, 'Ex: 123456', 'Digite o numero da NF'),
(1, 'Valor Total da Nota', 'number', true, 3, NULL, '0.00', 'Valor total em reais'),
(1, 'Foto da Nota Fiscal', 'photo', true, 4, '{"maxPhotos": 3}', NULL, 'Tire foto clara da NF'),
(1, 'Produtos conferidos?', 'dropdown', true, 5, '["Sim, todos conferidos", "Nao, faltou conferir", "Havia divergencia"]', NULL, NULL),
(1, 'Observacoes', 'text', false, 6, NULL, 'Observacoes opcionais...', NULL),
(1, 'Assinatura', 'signature', true, 7, NULL, NULL, 'Assine para confirmar');

-- Campos do Template 2: Recebimento - Aprendiz
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, placeholder, help_text) VALUES
(2, 'Numero da Nota Fiscal', 'text', true, 1, 'Ex: 123456', 'MESMO numero que o estoquista'),
(2, 'Numero do Lancamento Teknisa', 'text', true, 2, 'Ex: TK-789012', 'Codigo gerado no Teknisa'),
(2, 'Valor Lancado', 'number', true, 3, '0.00', 'Valor que voce lancou'),
(2, 'Observacoes', 'text', false, 4, 'Observacoes opcionais...', NULL),
(2, 'Assinatura', 'signature', true, 5, NULL, 'Assine para confirmar');

-- Campos do Template 3: Abertura de Loja
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(3, 'Horario de Chegada', 'datetime', true, 1, NULL, NULL, 'Registre seu horario de chegada'),
(3, 'Loja estava limpa?', 'dropdown', true, 2, '["Sim", "Nao", "Parcialmente"]', NULL, NULL),
(3, 'Equipamentos funcionando?', 'checkbox_multiple', true, 3, '["Geladeiras", "Freezers", "Ar condicionado", "Luzes", "Caixas registradoras"]', NULL, 'Marque os que estao funcionando'),
(3, 'Foto da fachada', 'photo', true, 4, '{"maxPhotos": 1}', NULL, 'Foto da entrada da loja'),
(3, 'Observacoes da abertura', 'text', false, 5, NULL, 'Algo a reportar?', NULL);

-- Campos do Template 4: Fechamento de Loja
INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text) VALUES
(4, 'Horario de Fechamento', 'datetime', true, 1, NULL, NULL, 'Registre o horario de fechamento'),
(4, 'Caixa conferido?', 'dropdown', true, 2, '["Sim, valores batem", "Nao, houve diferenca"]', NULL, NULL),
(4, 'Valor em caixa', 'number', true, 3, NULL, '0.00', 'Total em dinheiro'),
(4, 'Loja foi limpa?', 'dropdown', true, 4, '["Sim", "Nao"]', NULL, NULL),
(4, 'Equipamentos desligados?', 'checkbox_multiple', true, 5, '["Luzes internas", "Ar condicionado", "Computadores", "Letreiro"]', NULL, 'Marque os que foram desligados'),
(4, 'Foto do fechamento', 'photo', false, 6, '{"maxPhotos": 2}', NULL, 'Foto opcional'),
(4, 'Assinatura do responsavel', 'signature', true, 7, NULL, NULL, 'Assine para confirmar fechamento');

-- ============================================
-- 6. VISIBILIDADE DOS TEMPLATES POR LOJA
-- ============================================

-- Limpa visibilidade existente
DELETE FROM public.template_visibility WHERE template_id IN (1, 2, 3, 4);

-- Atribui visibilidade para todas as lojas
INSERT INTO public.template_visibility (template_id, store_id, roles)
SELECT 1, s.id, ARRAY['estoquista', 'supervisor', 'gerente']::text[]
FROM public.stores s;

INSERT INTO public.template_visibility (template_id, store_id, roles)
SELECT 2, s.id, ARRAY['aprendiz', 'supervisor', 'gerente']::text[]
FROM public.stores s;

INSERT INTO public.template_visibility (template_id, store_id, roles)
SELECT 3, s.id, ARRAY['estoquista', 'aprendiz', 'supervisor', 'gerente']::text[]
FROM public.stores s;

INSERT INTO public.template_visibility (template_id, store_id, roles)
SELECT 4, s.id, ARRAY['estoquista', 'aprendiz', 'supervisor', 'gerente']::text[]
FROM public.stores s;

-- ============================================
-- 7. VERIFICACAO FINAL
-- ============================================
SELECT 'Lojas:' as tipo, COUNT(*) as total FROM public.stores
UNION ALL
SELECT 'Templates:', COUNT(*) FROM public.checklist_templates
UNION ALL
SELECT 'Campos:', COUNT(*) FROM public.template_fields
UNION ALL
SELECT 'Visibilidades:', COUNT(*) FROM public.template_visibility
UNION ALL
SELECT 'Usuarios:', COUNT(*) FROM public.users
UNION ALL
SELECT 'User Roles:', COUNT(*) FROM public.user_store_roles;
