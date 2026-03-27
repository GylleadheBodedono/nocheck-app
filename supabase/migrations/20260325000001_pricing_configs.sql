-- ============================================
-- Tabela de pricing dinamico (planos gerenciados pelo superadmin)
-- ============================================

CREATE TABLE IF NOT EXISTS public.pricing_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_brl INT NOT NULL DEFAULT 0,
  max_users INT NOT NULL DEFAULT 5,
  max_stores INT NOT NULL DEFAULT 3,
  features TEXT[] NOT NULL DEFAULT '{}',
  stripe_price_id TEXT DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: leitura publica (landing page nao tem auth), escrita so superadmin
ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_public_read" ON pricing_configs
  FOR SELECT USING (true);

CREATE POLICY "pricing_superadmin_write" ON pricing_configs
  FOR ALL USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );
