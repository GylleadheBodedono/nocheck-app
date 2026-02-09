-- ============================================
-- 010: GPS automatico - colunas de localizacao
-- ============================================

-- Localizacao das lojas (admin configura via mapa)
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Localizacao capturada automaticamente nos checklists
ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS accuracy DOUBLE PRECISION;
