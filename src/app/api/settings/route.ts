export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

/**
 * GET /api/settings?key=validation_expiration_minutes
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .eq('key', key)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ key: data.key, value: data.value })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings
 * Body: { key: string, value: string }
 */
export async function PUT(request: NextRequest) {
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { key, value } = body as { key: string; value: string }

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, key, value })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
