import { requireAdmin } from '@/lib/server-auth'
import ValidacoesPageClient from './ValidacoesPageClient'

export default async function ValidacoesPage() {
  const { supabase } = await requireAdmin()

  // Fetch active stores
  const { data: storesData } = await supabase
    .from('stores')
    .select('*')
    .eq('is_active', true)
    .order('name')

  // Fetch active sectors
  const { data: sectorsData } = await supabase
    .from('sectors')
    .select('id, name, store_id')
    .eq('is_active', true)
    .order('name')

  // Fetch expiration setting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settingData } = await (supabase as any)
    .from('app_settings')
    .select('value')
    .eq('key', 'validation_expiration_minutes')
    .single()

  let expirationMinutes = 60
  if (settingData?.value) {
    const mins = parseInt(String(settingData.value), 10)
    if (!isNaN(mins) && mins > 0) expirationMinutes = mins
  }

  // Fetch validations with related data
  const { data: validationsData } = await supabase
    .from('cross_validations')
    .select(`
      *,
      store:stores(*),
      sector:sectors(name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <ValidacoesPageClient
      initialValidations={validationsData ?? []}
      initialStores={storesData ?? []}
      initialSectors={sectorsData ?? []}
      initialExpirationMinutes={expirationMinutes}
    />
  )
}
