import { requireAdmin } from '@/lib/server-auth'
import BrandingPageClient from './BrandingPageClient'

export default async function BrandingPage() {
  await requireAdmin()

  return <BrandingPageClient />
}
