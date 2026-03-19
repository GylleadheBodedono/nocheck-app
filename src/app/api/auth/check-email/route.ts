export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  // Requer autenticação para prevenir email enumeration
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ exists: false })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ exists: false })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .ilike('email', email)

    return NextResponse.json({ exists: (count ?? 0) > 0 })
  } catch {
    return NextResponse.json({ exists: false })
  }
}
