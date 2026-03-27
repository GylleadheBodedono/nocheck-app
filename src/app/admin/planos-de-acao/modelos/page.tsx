import { requireAdmin } from '@/lib/server-auth'
import ModelosPageClient from './ModelosPageClient'

export default async function ModelosPlanoDeAcaoPage() {
  await requireAdmin()

  return <ModelosPageClient />
}
