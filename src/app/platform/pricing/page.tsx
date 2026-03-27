import { requirePlatformAdmin } from '@/lib/server-auth'
import PricingPageClient from './PricingPageClient'

export default async function PlatformPricingPage() {
  const { supabase } = await requirePlatformAdmin()

  // Fetch all pricing configs (including inactive) for admin management
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('pricing_configs')
    .select('*')
    .order('sort_order', { ascending: true })

  return <PricingPageClient initialPlans={data ?? []} />
}
