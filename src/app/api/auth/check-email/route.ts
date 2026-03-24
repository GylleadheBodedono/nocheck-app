export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/auth/check-email
 * Verifica se um e-mail já está cadastrado na tabela `users`.
 * Usado no formulário de cadastro para exibir feedback antes do submit.
 * Não requer autenticação (público). Retorna `{ exists: boolean }`.
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
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
