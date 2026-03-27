import { requirePlatformAdmin } from '@/lib/server-auth'
import ConfiguracoesPageClient from './ConfiguracoesPageClient'

export default async function PlatformConfigPage() {
  await requirePlatformAdmin()

  return <ConfiguracoesPageClient />
}
