-- NôCheck - Corrige constraint UNIQUE da template_visibility
-- O sistema precisa suportar múltiplas rows por (template_id, store_id)
-- quando sector_id e/ou function_id são diferentes.
-- A constraint correta é UNIQUE(template_id, store_id, sector_id, function_id)

-- Dropa TODAS as possíveis constraints antigas (nomes variam conforme como o banco foi criado)
ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_store_unique;

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_id_store_id_key;

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_store_sector_key;

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_unique_combo;

-- Cria constraint correta incluindo sector_id e function_id
-- Usa NULLS NOT DISTINCT para que NULLs sejam tratados como iguais (evita duplicatas)
ALTER TABLE public.template_visibility
ADD CONSTRAINT template_visibility_unique_combo
UNIQUE NULLS NOT DISTINCT (template_id, store_id, sector_id, function_id);
