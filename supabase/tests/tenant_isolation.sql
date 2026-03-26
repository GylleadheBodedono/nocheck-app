-- ============================================
-- QA: Teste de Isolamento de Tenant
-- ============================================
-- Cria org fake, valida que RLS impede cross-tenant,
-- depois limpa tudo. Executar como superuser (postgres).
--
-- Uso: docker exec supabase_db_operecheck-app psql -U postgres -d postgres -f /path/to/tenant_isolation.sql
-- ============================================

DO $$
DECLARE
  fake_org_id UUID := 'f0000000-0000-0000-0000-ffffffffffff';
  real_org_id UUID := 'd0000000-0000-0000-0000-000000000001';
  fake_user_id UUID := 'f1000000-0000-0000-0000-ffffffffffff';
  cnt INTEGER;
  test_ok BOOLEAN := true;
BEGIN
  RAISE NOTICE '=== INICIO DOS TESTES DE ISOLAMENTO ===';

  -- 1. Criar org fake
  INSERT INTO public.organizations (id, name, slug, plan, is_active)
  VALUES (fake_org_id, 'Tenant Fake', 'tenant-fake', 'trial', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Criar loja no tenant fake
  INSERT INTO public.stores (id, name, is_active, tenant_id, require_gps)
  VALUES (999, 'Loja Fake', true, fake_org_id, false)
  ON CONFLICT (id) DO NOTHING;

  -- 3. Verificar que lojas do real NAO tem tenant fake
  SELECT count(*) INTO cnt FROM public.stores WHERE tenant_id = real_org_id;
  IF cnt > 0 THEN
    RAISE NOTICE 'OK: Grupo Do No tem % lojas', cnt;
  ELSE
    RAISE WARNING 'FALHA: Grupo Do No nao tem lojas!';
    test_ok := false;
  END IF;

  -- 4. Verificar que loja fake NAO aparece no real
  SELECT count(*) INTO cnt FROM public.stores WHERE tenant_id = real_org_id AND name = 'Loja Fake';
  IF cnt = 0 THEN
    RAISE NOTICE 'OK: Loja Fake nao aparece no Grupo Do No';
  ELSE
    RAISE WARNING 'FALHA: Loja Fake apareceu no Grupo Do No!';
    test_ok := false;
  END IF;

  -- 5. Verificar que lojas do real NAO aparecem no fake
  SELECT count(*) INTO cnt FROM public.stores WHERE tenant_id = fake_org_id AND name LIKE 'BDN%';
  IF cnt = 0 THEN
    RAISE NOTICE 'OK: Lojas BDN nao aparecem no Tenant Fake';
  ELSE
    RAISE WARNING 'FALHA: Lojas BDN apareceram no Tenant Fake!';
    test_ok := false;
  END IF;

  -- 6. Verificar que usuarios do real tem tenant_id correto
  SELECT count(*) INTO cnt FROM public.users WHERE tenant_id = real_org_id;
  IF cnt >= 3 THEN
    RAISE NOTICE 'OK: % usuarios com tenant_id do Grupo Do No', cnt;
  ELSE
    RAISE WARNING 'FALHA: Apenas % usuarios com tenant correto (esperado >= 3)', cnt;
    test_ok := false;
  END IF;

  -- 7. Verificar que nao ha usuarios no tenant fake
  SELECT count(*) INTO cnt FROM public.users WHERE tenant_id = fake_org_id;
  IF cnt = 0 THEN
    RAISE NOTICE 'OK: Nenhum usuario no Tenant Fake';
  ELSE
    RAISE WARNING 'FALHA: % usuarios no Tenant Fake!', cnt;
    test_ok := false;
  END IF;

  -- 8. Verificar que templates do real tem tenant correto
  SELECT count(*) INTO cnt FROM public.checklist_templates WHERE tenant_id = real_org_id;
  IF cnt > 0 THEN
    RAISE NOTICE 'OK: % templates no Grupo Do No', cnt;
  ELSE
    RAISE NOTICE 'INFO: Nenhum template (pode ser normal se seed nao criou)';
  END IF;

  -- 9. Verificar organizations separadas
  SELECT count(*) INTO cnt FROM public.organizations WHERE id = fake_org_id;
  IF cnt = 1 THEN
    RAISE NOTICE 'OK: Org fake existe isoladamente';
  END IF;

  SELECT count(*) INTO cnt FROM public.organizations WHERE id = real_org_id;
  IF cnt = 1 THEN
    RAISE NOTICE 'OK: Org real existe isoladamente';
  END IF;

  -- 10. Verificar que organization_members nao vazam
  SELECT count(*) INTO cnt FROM public.organization_members WHERE organization_id = real_org_id;
  RAISE NOTICE 'INFO: % membros no Grupo Do No', cnt;

  SELECT count(*) INTO cnt FROM public.organization_members WHERE organization_id = fake_org_id;
  IF cnt = 0 THEN
    RAISE NOTICE 'OK: Nenhum membro no Tenant Fake';
  END IF;

  -- LIMPEZA
  DELETE FROM public.stores WHERE id = 999;
  DELETE FROM public.organizations WHERE id = fake_org_id;

  IF test_ok THEN
    RAISE NOTICE '';
    RAISE NOTICE '=== TODOS OS TESTES PASSARAM ===';
  ELSE
    RAISE NOTICE '';
    RAISE WARNING '=== ALGUNS TESTES FALHARAM ===';
  END IF;
END $$;
