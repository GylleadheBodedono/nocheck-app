export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

// ── Supabase Service Client ──

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ── Route Handlers ──

/**
 * Retrieves application settings by key(s) from the `app_settings` table.
 *
 * Supports two query modes:
 * - Single key: `GET /api/settings?key=some_key`
 * - Multi-key:  `GET /api/settings?keys=key1,key2`
 *
 * @requires Authentication via `verifyApiAuth`
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const supabase = getServiceClient()

    // Multi-key lookup
    const keysParam = request.nextUrl.searchParams.get('keys')
    if (keysParam) {
      const keysArray = keysParam.split(',').map(k => k.trim()).filter(Boolean)
      if (keysArray.length === 0) {
        return NextResponse.json({ error: 'keys cannot be empty' }, { status: 400 })
      }
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', keysArray)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data || [])
    }

    // Single key lookup (backward compatible)
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'key or keys is required' }, { status: 400 })
    }

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
 * Creates or updates an application setting via upsert.
 *
 * `PUT /api/settings` with body `{ key: string, value: string }`.
 *
 * @requires Admin authentication via `verifyApiAuth`
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
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

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
