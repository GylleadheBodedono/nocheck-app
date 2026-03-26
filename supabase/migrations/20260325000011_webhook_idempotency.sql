-- Tabela para idempotencia de webhooks Stripe
-- Previne processamento duplicado quando Stripe retenta (ate 3 dias)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  org_id TEXT,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- Limpar eventos antigos (> 7 dias) automaticamente se pg_cron estiver disponivel
-- Caso contrario, limpar manualmente ou via Edge Function
