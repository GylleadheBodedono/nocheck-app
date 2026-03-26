-- ============================================
-- MIGRATION: Tenant Assets Storage Bucket
-- Bucket para logos, favicons e assets white-label
-- RLS: cada tenant so acessa tenant-assets/{seu_org_id}/*
-- ============================================

-- Criar bucket publico para assets de tenants
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,
  2097152,  -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura publica (logos precisam ser visiveis)
CREATE POLICY "tenant_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

-- Policy: upload/update somente por membros do tenant (via org_id no path)
CREATE POLICY "tenant_assets_tenant_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = (
      SELECT om.organization_id::text
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      LIMIT 1
    )
  );

-- Policy: update somente por membros do tenant
CREATE POLICY "tenant_assets_tenant_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = (
      SELECT om.organization_id::text
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      LIMIT 1
    )
  );

-- Policy: delete somente por membros do tenant
CREATE POLICY "tenant_assets_tenant_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tenant-assets'
    AND (storage.foldername(name))[1] = (
      SELECT om.organization_id::text
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
      LIMIT 1
    )
  );
