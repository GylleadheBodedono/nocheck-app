-- Colunas para rastrear mudancas de plano pendentes
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_plan TEXT DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;
