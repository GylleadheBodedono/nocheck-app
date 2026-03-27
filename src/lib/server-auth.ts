/**
 * Server-side auth guards for Server Components.
 * Reads session from cookies (set/refreshed by middleware).
 * Redirects on failure — never returns if unauthorized.
 */

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './supabase-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServerSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>> & Record<string, any>

export type AdminAuthResult = {
  user: { id: string; email: string }
  supabase: NonNullable<ServerSupabase>
}

/**
 * Requires authenticated admin user.
 * Redirects to /login if not authenticated, /dashboard if not admin.
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/login')

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  return { user: { id: user.id, email: user.email ?? '' }, supabase }
}

/**
 * Requires platform admin (superadmin).
 * Checks app_metadata or user_metadata for is_platform_admin flag.
 */
export async function requirePlatformAdmin(): Promise<AdminAuthResult> {
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/login')

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')

  const isPlatformAdmin =
    user.app_metadata?.is_platform_admin === true ||
    user.user_metadata?.is_platform_admin === true

  if (!isPlatformAdmin) redirect('/dashboard')

  return { user: { id: user.id, email: user.email ?? '' }, supabase }
}
