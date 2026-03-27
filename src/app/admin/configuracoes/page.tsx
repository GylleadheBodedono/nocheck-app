import { requireAdmin } from '@/lib/server-auth'
import ConfiguracoesPageClient from './ConfiguracoesPageClient'

export default async function ConfiguracoesPage() {
  const { user, supabase } = await requireAdmin()

  // Get user email
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('email')
    .eq('id', user.id)
    .single()

  // Fetch email template settings from app_settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: settings } = await (supabase as any)
    .from('app_settings')
    .select('key, value')
    .in('key', ['action_plan_email_subject', 'action_plan_email_template'])

  const settingsMap: Record<string, string> = {}
  for (const s of settings ?? []) {
    settingsMap[s.key] = s.value
  }

  return (
    <ConfiguracoesPageClient
      initialEmailSubject={settingsMap['action_plan_email_subject'] || undefined}
      initialEmailTemplate={settingsMap['action_plan_email_template'] || undefined}
      userEmail={profile?.email || user.email}
    />
  )
}
