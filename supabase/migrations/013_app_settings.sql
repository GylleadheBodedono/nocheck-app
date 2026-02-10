-- Tabela de configuracoes do aplicativo
-- Permite ao admin configurar parametros como tempo de expiracao de validacoes

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valor padrao: 60 minutos para expiracao de validacao cruzada
INSERT INTO public.app_settings (key, value, description)
VALUES ('validation_expiration_minutes', '60', 'Tempo em minutos para expirar validacoes cruzadas pendentes')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Leitura para todos os autenticados
CREATE POLICY "Autenticados podem ler configuracoes"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita apenas para admins (via service role ou check manual)
CREATE POLICY "Admins podem atualizar configuracoes"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
