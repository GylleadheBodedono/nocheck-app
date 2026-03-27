import { requireAdmin } from '@/lib/server-auth'
import RelatoriosPageClient from './RelatoriosPageClient'

export default async function RelatoriosPage() {
  await requireAdmin()

  return <RelatoriosPageClient />
}
