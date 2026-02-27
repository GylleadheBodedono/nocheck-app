-- Tabela de favoritos do admin (templates e usuarios)
CREATE TABLE IF NOT EXISTS public.admin_favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('template', 'user')),
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_favorites_user ON public.admin_favorites(user_id, entity_type);

-- RLS
ALTER TABLE public.admin_favorites ENABLE ROW LEVEL SECURITY;

-- Admin pode gerenciar seus proprios favoritos
CREATE POLICY "admin_favorites_select" ON public.admin_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_favorites_insert" ON public.admin_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_favorites_delete" ON public.admin_favorites
  FOR DELETE USING (auth.uid() = user_id);
