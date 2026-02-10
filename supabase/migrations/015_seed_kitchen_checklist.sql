-- ============================================
-- Migration 015: Seed - Checklist Diario Cozinha
-- ============================================
-- Baseado em /home/estagiario/Downloads/checklist-cozinha.md
-- 4 secoes, 27 campos yes_no
-- NAO insere visibility — admin configura depois pelo frontend

DO $$
DECLARE
  v_template_id BIGINT;
  v_sec1_id BIGINT;
  v_sec2_id BIGINT;
  v_sec3_id BIGINT;
  v_sec4_id BIGINT;
  v_sort INT := 0;
BEGIN

-- 1. Criar template
INSERT INTO checklist_templates (name, description, category, is_active)
VALUES (
  'Checklist Diario — Cozinha',
  'Checklist completo para operacao diaria da cozinha, dividido em 4 etapas: inicio do turno, pre-preparo, preparo e finalizacao.',
  'abertura',
  true
)
RETURNING id INTO v_template_id;

-- 2. Criar secoes
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

-- 3. Campos — Secao 1: Inicio do Turno (8 campos)
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

-- 4. Campos — Secao 2: Pre-preparo (6 campos)
v_sort := 9;

INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec2_id, 'Inspecionar materia-prima (qualidade, validade, temperatura, aparencia)', 'yes_no', true, v_sort),
  (v_template_id, v_sec2_id, 'Higienizar frutas, legumes e verduras', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec2_id, 'Cortar e porcionar conforme fichas tecnicas', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec2_id, 'Preparar caldos, molhos ou bases (se aplicavel)', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec2_id, 'Descongelar itens conforme normas de seguranca alimentar', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec2_id, 'Etiquetar e armazenar ingredientes prontos para uso', 'yes_no', true, v_sort + 5);

-- 5. Campos — Secao 3: Preparo (6 campos)
v_sort := 15;

INSERT INTO template_fields (template_id, section_id, name, field_type, is_required, sort_order)
VALUES
  (v_template_id, v_sec3_id, 'Manter area limpa e organizada durante toda a operacao', 'yes_no', true, v_sort),
  (v_template_id, v_sec3_id, 'Seguir fichas tecnicas (utensilios e ingredientes)', 'yes_no', true, v_sort + 1),
  (v_template_id, v_sec3_id, 'Controlar tempo e temperatura de coccao', 'yes_no', true, v_sort + 2),
  (v_template_id, v_sec3_id, 'Evitar contaminacao cruzada (tabuas e facas separadas por tipo de alimento)', 'yes_no', true, v_sort + 3),
  (v_template_id, v_sec3_id, 'Registrar producao (quantidade, horario, responsavel)', 'yes_no', true, v_sort + 4),
  (v_template_id, v_sec3_id, 'Proibido uso de eletronicos pessoais (celular, fones etc.)', 'yes_no', true, v_sort + 5);

-- 6. Campos — Secao 4: Finalizacao / Troca de Turno (7 campos)
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

RAISE NOTICE 'Checklist Cozinha criado: template_id=%, secoes: %,%,%,%', v_template_id, v_sec1_id, v_sec2_id, v_sec3_id, v_sec4_id;

END $$;
