import { requireAdmin } from '@/lib/server-auth'
import FotosNcPageClient from './FotosNcPageClient'

export default async function FotosNCPage() {
  await requireAdmin()

  return <FotosNcPageClient />
}
