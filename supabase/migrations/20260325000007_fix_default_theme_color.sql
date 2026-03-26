-- Fix: cor padrao do tema era #264653 (NoCheck antigo), deveria ser #0D9488 (OpereCheck teal)
ALTER TABLE organizations ALTER COLUMN settings SET DEFAULT '{"theme":{"primaryColor":"#0D9488","logoUrl":null,"faviconUrl":null,"appName":"Sistema"},"customDomain":null,"emailFrom":null}'::jsonb;

-- Fix retroativo para orgs que ainda tem a cor antiga
UPDATE organizations SET settings = jsonb_set(settings, '{theme,primaryColor}', '"#0D9488"')
WHERE settings->'theme'->>'primaryColor' = '#264653';
