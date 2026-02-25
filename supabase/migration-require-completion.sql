-- Migration: Adicionar campos de exigencia para conclusao de planos de acao
-- e campos de configuracao nos modelos (presets) e condicoes (field_conditions)

-- action_plan_presets: config por modelo
ALTER TABLE action_plan_presets
  ADD COLUMN IF NOT EXISTS require_photo_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_text_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_max_chars integer DEFAULT 800;

-- field_conditions: config para planos auto-gerados
ALTER TABLE field_conditions
  ADD COLUMN IF NOT EXISTS require_photo_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_text_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_max_chars integer DEFAULT 800;

-- action_plans: copiar config do preset/condition quando o plano e criado
ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS require_photo_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_text_on_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_max_chars integer DEFAULT 800,
  ADD COLUMN IF NOT EXISTS completion_text text;
