-- Script de Dados de Teste para NoCheck
-- Execute este script no Supabase SQL Editor

-- ==============================================
-- 1. LOJAS (8 lojas)
-- ==============================================
INSERT INTO stores (name, cnpj, address, is_active) VALUES
  ('Loja Centro', '12345678000101', 'Rua Principal, 100 - Centro', true),
  ('Loja Norte', '12345678000102', 'Av. Norte, 200 - Zona Norte', true),
  ('Loja Sul', '12345678000103', 'Av. Sul, 300 - Zona Sul', true),
  ('Loja Leste', '12345678000104', 'Rua Leste, 400 - Zona Leste', true),
  ('Loja Oeste', '12345678000105', 'Av. Oeste, 500 - Zona Oeste', true),
  ('Loja Shopping', '12345678000106', 'Shopping Center, Loja 10', true),
  ('Loja Matriz', '12345678000107', 'Praça Central, 1', true),
  ('Loja Filial', '12345678000108', 'Av. Secundária, 50', true)
ON CONFLICT (id) DO NOTHING;

-- ==============================================
-- 2. SETORES (2 por loja: Cozinha e Salão)
-- ==============================================
INSERT INTO sectors (store_id, name, is_active)
SELECT s.id, 'Cozinha', true FROM stores s WHERE s.name LIKE 'Loja%'
ON CONFLICT DO NOTHING;

INSERT INTO sectors (store_id, name, is_active)
SELECT s.id, 'Salão', true FROM stores s WHERE s.name LIKE 'Loja%'
ON CONFLICT DO NOTHING;

-- ==============================================
-- 3. ROLES (Funções/Cargos)
-- ==============================================
INSERT INTO roles (slug, name, permissions) VALUES
  ('gerente', 'Gerente', '{"view": true, "edit": true, "delete": true, "create": true, "approve": true}'::jsonb),
  ('supervisor', 'Supervisor', '{"view": true, "edit": true, "delete": false, "create": true, "approve": true}'::jsonb),
  ('operador', 'Operador', '{"view": true, "edit": true, "delete": false, "create": false, "approve": false}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================
-- 4. TEMPLATES DE CHECKLIST
-- ==============================================
INSERT INTO checklist_templates (name, description, category, is_active) VALUES
  ('Abertura de Loja', 'Checklist para abertura diária da loja', 'operacional', true),
  ('Fechamento de Loja', 'Checklist para fechamento da loja', 'operacional', true),
  ('Higiene - Cozinha', 'Verificação de higiene da cozinha', 'seguranca', true),
  ('Higiene - Salão', 'Verificação de higiene do salão', 'seguranca', true),
  ('Manutenção Equipamentos', 'Checklist de manutenção de equipamentos', 'manutencao', true),
  ('Controle de Estoque', 'Inventário e controle de produtos', 'gestao', true)
ON CONFLICT DO NOTHING;

-- ==============================================
-- 5. CAMPOS DOS TEMPLATES
-- ==============================================

-- Template: Abertura de Loja
INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Loja está limpa?', 'boolean', true, 1, 'Verifique se a loja está limpa e organizada'
FROM checklist_templates t WHERE t.name = 'Abertura de Loja';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Luzes funcionando?', 'boolean', true, 2, 'Verifique se todas as luzes estão funcionando'
FROM checklist_templates t WHERE t.name = 'Abertura de Loja';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Caixa verificado?', 'boolean', true, 3, 'Confira o valor inicial do caixa'
FROM checklist_templates t WHERE t.name = 'Abertura de Loja';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Observações', 'text', false, 4, 'Anotações adicionais'
FROM checklist_templates t WHERE t.name = 'Abertura de Loja';

-- Template: Higiene - Cozinha
INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Superfícies limpas?', 'boolean', true, 1, 'Todas as superfícies devem estar higienizadas'
FROM checklist_templates t WHERE t.name = 'Higiene - Cozinha';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Geladeira organizada?', 'boolean', true, 2, 'Verifique organização e temperatura'
FROM checklist_templates t WHERE t.name = 'Higiene - Cozinha';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Temperatura geladeira', 'number', true, 3, 'Registre a temperatura em Celsius'
FROM checklist_templates t WHERE t.name = 'Higiene - Cozinha';

INSERT INTO template_fields (template_id, name, field_type, is_required, sort_order, help_text)
SELECT t.id, 'Foto do ambiente', 'photo', false, 4, 'Tire uma foto como evidência'
FROM checklist_templates t WHERE t.name = 'Higiene - Cozinha';

-- ==============================================
-- 6. VISIBILIDADE DOS TEMPLATES (para todas as lojas)
-- ==============================================
INSERT INTO template_visibility (template_id, store_id, roles)
SELECT t.id, s.id, ARRAY['gerente', 'supervisor', 'operador']::text[]
FROM checklist_templates t
CROSS JOIN stores s
WHERE t.is_active = true AND s.is_active = true
ON CONFLICT DO NOTHING;

-- ==============================================
-- 7. VINCULAR ADMIN AOS SETORES (opcional)
-- ==============================================
-- Descomente se quiser vincular o admin a todos os setores
-- INSERT INTO user_sectors (user_id, sector_id, role)
-- SELECT u.id, sec.id, 'gerente'
-- FROM users u
-- CROSS JOIN sectors sec
-- WHERE u.is_admin = true
-- ON CONFLICT DO NOTHING;

-- ==============================================
-- VERIFICAÇÃO
-- ==============================================
SELECT 'Lojas criadas:' as info, COUNT(*) as total FROM stores;
SELECT 'Setores criados:' as info, COUNT(*) as total FROM sectors;
SELECT 'Templates criados:' as info, COUNT(*) as total FROM checklist_templates;
SELECT 'Campos criados:' as info, COUNT(*) as total FROM template_fields;
SELECT 'Visibilidades criadas:' as info, COUNT(*) as total FROM template_visibility;
