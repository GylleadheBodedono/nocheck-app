-- Salvar o plano anterior ao downgrade para exibir no banner
-- "Voce ainda tem acesso ao plano Starter por mais X dias"
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS previous_plan TEXT DEFAULT NULL;
