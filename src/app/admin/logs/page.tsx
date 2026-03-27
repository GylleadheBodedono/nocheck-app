import { requireAdmin } from '@/lib/server-auth'
import LogsPageClient from './LogsPageClient'

export default async function AdminLogsPage() {
  const { supabase } = await requireAdmin()

  // Fetch logs with user info
  const { data: logsData } = await supabase
    .from('client_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  // Get user names for logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set((logsData ?? []).filter((l: any) => l.user_id).map((l: any) => l.user_id))]
  let userMap: Record<string, { name: string; email: string }> = {}

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds)
    if (users) {
      userMap = Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users.map((u: any) => [u.id, { name: u.full_name, email: u.email }])
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logsWithUsers = (logsData ?? []).map((l: any) => ({
    ...l,
    user_name: l.user_id ? userMap[l.user_id]?.name : undefined,
    user_email: l.user_id ? userMap[l.user_id]?.email : undefined,
  }))

  return <LogsPageClient initialLogs={logsWithUsers} />
}
