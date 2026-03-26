export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { verifyTenantAccess } from '@/lib/withTenantAuth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null // 'logo' or 'favicon'
    const orgId = formData.get('orgId') as string | null

    if (!file || !type || !orgId) {
      return NextResponse.json({ error: 'file, type e orgId sao obrigatorios' },
        { status: 400 }
      )
    }

    // Verificar que o usuario pertence a esta org
    const tenantAuth = await verifyTenantAccess(request, orgId)
    if (tenantAuth.error) return tenantAuth.error

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Formato invalido. Use PNG, JPG, SVG ou WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Maximo 2MB.' },
        { status: 400 }
      )
    }

    if (type !== 'logo' && type !== 'favicon') {
      return NextResponse.json(
        { error: 'type deve ser "logo" ou "favicon"' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Determine file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const filePath = `${orgId}/${type}.${ext}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('tenant-assets')
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('[Upload Logo] Storage error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('tenant-assets')
      .getPublicUrl(filePath)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error) {
    console.error('[Upload Logo] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro no upload' },
      { status: 500 }
    )
  }
}
