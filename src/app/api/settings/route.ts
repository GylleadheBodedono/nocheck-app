export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'
import type { UpdateSettingRequestDTO, UpdateSettingResponseDTO, SettingDTO } from '@/dtos'

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
  const log = createRequestLogger(request)
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
        log.error('Erro ao buscar configuracoes (multi-key)', { keys: keysArray }, error)
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
      log.warn('Configuracao nao encontrada', { key })
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Resposta tipada via DTO de configuração individual
    const settingResponse: SettingDTO = { key: data.key, value: data.value }
    return NextResponse.json(settingResponse)
  } catch (error) {
    log.error('Erro inesperado em GET /api/settings', {}, error)
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
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    // Extrai e tipifica o body com o DTO de atualização de configuração
    const body = await request.json() as UpdateSettingRequestDTO
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) {
      log.error('Erro ao salvar configuracao', { key }, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Resposta tipada via DTO de confirmação de atualização
    const updateResponse: UpdateSettingResponseDTO = { success: true, key, value }
    return NextResponse.json(updateResponse)
  } catch (error) {
    log.error('Erro inesperado em PUT /api/settings', {}, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
