-- ============================================
-- MIGRATION 006: Criar bucket de imagens
-- ============================================

-- Criar o bucket para armazenar imagens dos checklists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-images',
  'checklist-images',
  true,  -- Bucket público para facilitar visualização
  2097152, -- 2MB limite
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política: Permitir upload por usuários autenticados
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklist-images');

-- Política: Permitir leitura pública das imagens
CREATE POLICY "Anyone can view checklist images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'checklist-images');

-- Política: Permitir que usuários deletem suas próprias imagens (opcional)
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'checklist-images');
