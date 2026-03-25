export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'

/**
 * POST /api/auth/check-email
 * Verifica se um e-mail já está cadastrado na tabela `users`.
 * Usado no formulário de "esqueci minha senha" para validar o e-mail antes do envio.
 * Retorna `{ exists: false }` para entradas inválidas para prevenir enumeração de emails.
 * Requer autenticação via `verifyApiAuth`.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ exists: false })
    }

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
  } catch (err) {
    log.error('Erro ao verificar email', {}, err)
    return NextResponse.json({ exists: false })
  }
}
