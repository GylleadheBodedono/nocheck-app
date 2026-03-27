import { requireAdmin } from '@/lib/server-auth'
import PlanosRelatorioPageClient from './PlanosRelatorioPageClient'

export default async function PlanoDeAcaoReportPage() {
  await requireAdmin()

  return <PlanosRelatorioPageClient />
}
