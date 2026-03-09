export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUCKET = 'checklist-images'

type StorageFileItem = {
  name: string
  created_at: string
  size: number
  publicUrl: string
  path: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listRecursive(supabase: any, folder: string, maxDepth = 4): Promise<StorageFileItem[]> {
  const { data: entries } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 500, sortBy: { column: 'created_at', order: 'desc' } })

  if (!entries) return []

  const files: StorageFileItem[] = []
  const subfolders: string[] = []

  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('.')) continue
    if (entry.id) {
      const fullPath = `${folder}/${entry.name}`
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
      files.push({
        name: entry.name,
        created_at: entry.created_at,
        size: entry.metadata?.size || 0,
        publicUrl: urlData.publicUrl,
        path: fullPath,
      })
    } else if (maxDepth > 0) {
      subfolders.push(`${folder}/${entry.name}`)
    }
  }

  for (const sub of subfolders) {
    const subFiles = await listRecursive(supabase, sub, maxDepth - 1)
    files.push(...subFiles)
  }

  return files
}

/**
 * GET /api/storage?folder=uploads
 * Lista arquivos de uma pasta no bucket (recursivo)
 */
export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const folder = request.nextUrl.searchParams.get('folder') || 'uploads'

    if (!folder.startsWith('uploads') && !folder.startsWith('anexos')) {
      return NextResponse.json({ success: false, error: 'Pasta invalida' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const items = await listRecursive(supabase, folder)

    return NextResponse.json({ success: true, files: items, folder })
  } catch (error) {
    console.error('[Storage] Erro ao listar:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/storage
 * Remove arquivos do bucket
 * Body: { paths: ['uploads/file1.jpg'] }
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyApiAuth(request, true)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { paths } = body as { paths: string[] }

    if (!paths || paths.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum arquivo especificado' }, { status: 400 })
    }

    // Validate paths are in allowed folders
    for (const p of paths) {
      if (!p.startsWith('uploads/') && !p.startsWith('anexos/')) {
        return NextResponse.json({ success: false, error: 'Caminho invalido' }, { status: 400 })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(paths)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true, deleted: paths.length })
  } catch (error) {
    console.error('[Storage] Erro ao deletar:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
