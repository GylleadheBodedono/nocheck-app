import { requirePlatformAdmin } from '@/lib/server-auth'
import SuportePageClient from './SuportePageClient'

export default async function PlatformSupportPage() {
  await requirePlatformAdmin()

  return <SuportePageClient />
}
