import { requireAdmin } from '@/lib/server-auth'
import GaleriaPageClient from './GaleriaPageClient'

/**
 * Server component for `/admin/galeria`.
 * Validates admin authentication server-side, then delegates
 * all file management to the client component.
 *
 * File listing stays client-side because it relies on the
 * `/api/storage` endpoint which generates signed public URLs.
 */
export default async function GaleriaPage() {
  await requireAdmin()

  return <GaleriaPageClient />
}
