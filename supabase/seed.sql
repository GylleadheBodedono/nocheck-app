-- ============================================
-- NoCheck - Dados Iniciais (Seed)
-- ============================================
-- Execute APOS o schema.sql em um banco limpo.
-- Insere funcoes padrao, app_settings e template de exemplo.
-- Lojas e setores devem ser criados via admin ou scripts separados.
-- ============================================

-- ============================================
-- 1. FUNCOES PADRAO
-- ============================================
INSERT INTO public.functions (name, description, color, icon) VALUES
  ('Estoquista', 'Recebimento e controle de estoque', '#10b981', 'package'),
  ('Cozinheiro', 'Preparacao de alimentos e higiene', '#f59e0b', 'flame'),
  ('Zelador', 'Limpeza e manutencao geral', '#8b5cf6', 'sparkles'),
  ('Garcom', 'Atendimento ao cliente no salao', '#3b82f6', 'users'),
  ('Aprendiz', 'Funcionario em treinamento', '#f97316', 'book-open')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. CONFIGURACOES DO APP
-- ============================================
INSERT INTO public.app_settings (key, value, description) VALUES
  ('ignore_time_restrictions', 'false', 'Se true, ignora restricoes de horario dos templates (para testes)')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. TEMPLATES DE EXEMPLO (Recebimento)
-- ============================================

-- Template: Recebimento - Estoquista
INSERT INTO public.checklist_templates (name, description, category, created_by)
VALUES (
  'Recebimento - Estoquista',
  'Checklist para recebimento de mercadorias pelo estoquista',
  'recebimento',
  NULL
) ON CONFLICT DO NOTHING;

DO $$
DECLARE
  template_id_var INTEGER;
BEGIN
  SELECT id INTO template_id_var FROM public.checklist_templates WHERE name = 'Recebimento - Estoquista' LIMIT 1;

  IF template_id_var IS NOT NULL THEN
    INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text)
    VALUES
      (template_id_var, 'Fornecedor', 'dropdown', true, 1,
        '["Ambev", "Coca-Cola", "JBS", "BRF", "Nestle", "Unilever", "PepsiCo", "Heineken", "Schincariol", "Outros"]'::jsonb,
        NULL, 'Selecione o fornecedor da entrega'),
      (template_id_var, 'Numero da Nota Fiscal', 'text', true, 2, NULL, 'Ex: 123456', 'Digite o numero da NF'),
      (template_id_var, 'Valor Total da Nota', 'number', true, 3, NULL, 'R$ 0,00', 'Valor total em reais'),
      (template_id_var, 'Confirme o Valor Total', 'number', true, 4, NULL, 'R$ 0,00', 'Digite novamente para confirmar'),
      (template_id_var, 'Foto da Nota Fiscal', 'photo', true, 5, '{"minPhotos": 1, "maxPhotos": 3}'::jsonb, NULL, 'Tire foto clara da NF'),
      (template_id_var, 'Contei todos os volumes?', 'yes_no', true, 6, NULL, NULL, NULL),
      (template_id_var, 'Conferi os produtos?', 'yes_no', true, 7, NULL, NULL, NULL),
      (template_id_var, 'Observacoes', 'text', false, 8, NULL, 'Observacoes opcionais...', NULL),
      (template_id_var, 'Localizacao', 'gps', true, 9, NULL, NULL, 'Captura automatica'),
      (template_id_var, 'Assinatura do Estoquista', 'signature', true, 10, NULL, NULL, 'Assine para confirmar')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Template: Recebimento - Aprendiz
INSERT INTO public.checklist_templates (name, description, category, created_by)
VALUES (
  'Recebimento - Aprendiz',
  'Checklist para lancamento no Teknisa pelo aprendiz',
  'recebimento',
  NULL
) ON CONFLICT DO NOTHING;

DO $$
DECLARE
  template_id_var INTEGER;
BEGIN
  SELECT id INTO template_id_var FROM public.checklist_templates WHERE name = 'Recebimento - Aprendiz' LIMIT 1;

  IF template_id_var IS NOT NULL THEN
    INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, placeholder, help_text)
    VALUES
      (template_id_var, 'Numero da Nota Fiscal', 'text', true, 1, 'Ex: 123456', 'MESMO numero que o estoquista'),
      (template_id_var, 'Numero do Lancamento Teknisa', 'text', true, 2, 'Ex: TK-789012', 'Codigo gerado no Teknisa'),
      (template_id_var, 'Valor Lancado no Teknisa', 'number', true, 3, 'R$ 0,00', 'Valor que voce lancou'),
      (template_id_var, 'Confirme o Valor Lancado', 'number', true, 4, 'R$ 0,00', 'Digite novamente para confirmar'),
      (template_id_var, 'Observacoes do Lancamento', 'text', false, 5, 'Observacoes opcionais...', NULL),
      (template_id_var, 'Assinatura do Aprendiz', 'signature', true, 6, NULL, 'Assine para confirmar')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================
-- 4. TEMPLATE DE EXEMPLO (Checklist Diario Cozinha)
-- ============================================

DO $$
DECLARE
  v_template_id BIGINT;
  v_sec1_id BIGINT;
  v_sec2_id BIGINT;
  v_sec3_id BIGINT;
  v_sec4_id BIGINT;
  v_sort INT := 0;
BEGIN

INSERT INTO checklist_templates (name, description, category, is_active)
VALUES (
  'Checklist Diario — Cozinha',
  'Checklist completo para operacao diaria da cozinha, dividido em 4 etapas: inicio do turno, pre-preparo, preparo e finalizacao.',
  'abertura',
  true
)
RETURNING id INTO v_template_id;

-- Secoes
INSERT INTO template_sections (template_id, name, description, sort_order)
VALUES (v_template_id, 'Inicio do Turno', 'Verificacoes ao abrir o turno', 1)
RETURNING id INTO v_sec1_id;

INSERT INTO template_sections (template_id, name, description, sort_order)
VALUES (v_template_id, 'Pre-preparo', 'Inspecao e preparo de ingredientes', 2)
RETURNING id INTO v_sec2_id;

INSERT INTO template_sections (template_id, name, description, sort_order)
VALUES (v_template_id, 'Preparo', 'Durante a operacao de cozinha', 3)
RETURNING id INTO v_sec3_id;

INSERT INTO template_sections (template_id, name, description, sort_order)
VALUES (v_template_id, 'Finalizacao / Troca de Turno', 'Ao encerrar o turno', 4)
RETURNING id INTO v_sec4_id;

-- Secao 1: Inicio do Turno (8 campos)
v_sort := 1;
INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec1_id, 'Higienizar maos e vestir uniforme completo (touca, avental, luvas)', 'yes_no', true, v_sort),
  (v_template_id, v_sec1_id, 'Conferir higiene pessoal da equipe (sem barba exposta, cabelos presos/cobertos, unhas curtas, sem acessorios)', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec1_id, 'Verificar limpeza de bancadas e superficies', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec1_id, 'Checar equipamentos — funcionamento e limpeza (fogao, forno, liquidificador etc.)', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec1_id, 'Checar temperatura de geladeiras e freezers', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec1_id, 'Conferir recebimento e armazenamento dos ingredientes do dia', 'yes_no', true, v_sort + 5),
  (v_template_id, v_sec1_id, 'Separar utensilios necessarios', 'yes_no', true, v_sort + 6),
  (v_template_id, v_sec1_id, 'Conferir estoque de produtos: 10% (diurno) / 30% (noturno)', 'yes_no', true, v_sort + 7);

-- Secao 2: Pre-preparo (6 campos)
v_sort := 9;
INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec2_id, 'Inspecionar materia-prima (qualidade, validade, temperatura, aparencia)', 'yes_no', true, v_sort),
  (v_template_id, v_sec2_id, 'Higienizar frutas, legumes e verduras', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec2_id, 'Cortar e porcionar conforme fichas tecnicas', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec2_id, 'Preparar caldos, molhos ou bases (se aplicavel)', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec2_id, 'Descongelar itens conforme normas de seguranca alimentar', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec2_id, 'Etiquetar e armazenar ingredientes prontos para uso', 'yes_no', true, v_sort + 5);

-- Secao 3: Preparo (6 campos)
v_sort := 15;
INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec3_id, 'Manter area limpa e organizada durante toda a operacao', 'yes_no', true, v_sort),
  (v_template_id, v_sec3_id, 'Seguir fichas tecnicas (utensilios e ingredientes)', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec3_id, 'Controlar tempo e temperatura de coccao', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec3_id, 'Evitar contaminacao cruzada (tabuas e facas separadas por tipo de alimento)', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec3_id, 'Registrar producao (quantidade, horario, responsavel)', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec3_id, 'Proibido uso de eletronicos pessoais (celular, fones etc.)', 'yes_no', true, v_sort + 5);

-- Secao 4: Finalizacao / Troca de Turno (7 campos)
v_sort := 21;
INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec4_id, 'Armazenar corretamente alimentos prontos', 'yes_no', true, v_sort),
  (v_template_id, v_sec4_id, 'Limpar e guardar utensilios e equipamentos', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec4_id, 'Descartar residuos conforme normas', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec4_id, 'Registrar sobras e perdas', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec4_id, 'Fazer lista de reposicao para o dia seguinte', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec4_id, 'Conferir estado geral dos equipamentos do setor', 'yes_no', true, v_sort + 5),
  (v_template_id, v_sec4_id, 'Informar ao superior qualquer emergencia ou divergencia', 'yes_no', true, v_sort + 6);

END $$;

-- ============================================
-- FIM DOS DADOS INICIAIS
-- ============================================
