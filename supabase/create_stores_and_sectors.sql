-- ============================================
-- CRIAR 8 LOJAS + 6 SETORES CADA
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- 1. CRIAR/ATUALIZAR AS 8 LOJAS
INSERT INTO public.stores (id, name, is_active) VALUES
  (1, 'BDN Boa Viagem', true),
  (2, 'BDN Guararapes', true),
  (3, 'BDN Afogados', true),
  (4, 'BDN Tacaruna', true),
  (5, 'BDN Olinda', true),
  (6, 'BRG Boa Viagem', true),
  (7, 'BRG Riomar', true),
  (8, 'BRG Guararapes', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Garante que a sequence de IDs está atualizada
SELECT setval('stores_id_seq', (SELECT MAX(id) FROM public.stores));

-- 2. LIMPA SETORES EXISTENTES (para evitar duplicatas)
DELETE FROM public.sectors WHERE store_id IN (1, 2, 3, 4, 5, 6, 7, 8);

-- 3. CRIA OS 6 SETORES PARA CADA LOJA
INSERT INTO public.sectors (store_id, name, description, color, icon, is_active) VALUES
  -- BDN Boa Viagem (id=1)
  (1, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (1, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (1, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (1, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (1, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (1, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BDN Guararapes (id=2)
  (2, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (2, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (2, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (2, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (2, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (2, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BDN Afogados (id=3)
  (3, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (3, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (3, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (3, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (3, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (3, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BDN Tacaruna (id=4)
  (4, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (4, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (4, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (4, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (4, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (4, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BDN Olinda (id=5)
  (5, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (5, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (5, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (5, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (5, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (5, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BRG Boa Viagem (id=6)
  (6, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (6, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (6, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (6, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (6, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (6, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BRG Riomar (id=7)
  (7, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (7, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (7, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (7, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (7, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (7, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true),

  -- BRG Guararapes (id=8)
  (8, 'Cozinha',       'Setor da cozinha',        '#f59e0b', 'flame',      true),
  (8, 'Estoque',       'Setor de estoque',        '#10b981', 'package',    true),
  (8, 'Salão',         'Setor do salão',          '#6366f1', 'users',      true),
  (8, 'Caixa',         'Setor do caixa',          '#ef4444', 'dollar-sign', true),
  (8, 'Delivery',      'Setor de delivery',       '#8b5cf6', 'truck',      true),
  (8, 'Administração', 'Setor administrativo',    '#3b82f6', 'briefcase',  true);

-- 4. VERIFICAÇÃO
SELECT
  s.name AS loja,
  COUNT(sec.id) AS total_setores,
  STRING_AGG(sec.name, ', ' ORDER BY sec.name) AS setores
FROM public.stores s
LEFT JOIN public.sectors sec ON sec.store_id = s.id AND sec.is_active = true
WHERE s.is_active = true
GROUP BY s.id, s.name
ORDER BY s.id;
