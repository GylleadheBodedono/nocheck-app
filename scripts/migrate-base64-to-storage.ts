/**
 * Script para migrar fotos base64 do value_json para Supabase Storage.
 *
 * Problema: 194 registros em checklist_responses tem fotos como base64 no JSON,
 * ocupando 52 MB no banco. Este script faz upload ao Storage e substitui por URL.
 *
 * Rodar: npx tsx scripts/migrate-base64-to-storage.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xoxwtdidepuuhpdmwoty.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY nao configurada. Use:')
  console.error('SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-base64-to-storage.ts')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function base64ToBuffer(base64: string): { buffer: Buffer; mimeType: string } {
  const match = base64.match(/^data:(image\/\w+);base64,(.+)$/)
  if (!match) throw new Error('Invalid base64 format')
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] }
}

async function uploadPhoto(base64: string, path: string): Promise<string | null> {
  try {
    const { buffer, mimeType } = base64ToBuffer(base64)
    const ext = mimeType.split('/')[1] || 'jpg'
    const fullPath = `${path}.${ext}`

    const { error } = await supabase.storage
      .from('checklist-images')
      .upload(fullPath, buffer, { contentType: mimeType, upsert: true })

    if (error) {
      console.error(`  Upload failed for ${fullPath}:`, error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from('checklist-images').getPublicUrl(fullPath)
    return urlData.publicUrl
  } catch (err) {
    console.error(`  Upload error:`, err)
    return null
  }
}

async function migrateRow(row: { id: number; field_id: number; checklist_id: number; value_json: Record<string, unknown> }) {
  const json = { ...row.value_json }
  let changed = false

  // Migrar photos
  if (Array.isArray(json.photos)) {
    const newPhotos: string[] = []
    for (let i = 0; i < (json.photos as string[]).length; i++) {
      const photo = (json.photos as string[])[i]
      if (photo.startsWith('data:image')) {
        const url = await uploadPhoto(photo, `migration/cl${row.checklist_id}/field_${row.field_id}_foto_${i + 1}`)
        if (url) {
          newPhotos.push(url)
          changed = true
          console.log(`  ✓ photo ${i + 1} uploaded`)
        } else {
          newPhotos.push(photo) // manter base64 se upload falhou
        }
      } else {
        newPhotos.push(photo) // ja e URL
      }
    }
    json.photos = newPhotos
  }

  // Migrar conditionalPhotos
  if (Array.isArray(json.conditionalPhotos)) {
    const newPhotos: string[] = []
    for (let i = 0; i < (json.conditionalPhotos as string[]).length; i++) {
      const photo = (json.conditionalPhotos as string[])[i]
      if (photo.startsWith('data:image')) {
        const url = await uploadPhoto(photo, `migration/cl${row.checklist_id}/field_${row.field_id}_cond_foto_${i + 1}`)
        if (url) {
          newPhotos.push(url)
          changed = true
          console.log(`  ✓ conditionalPhoto ${i + 1} uploaded`)
        } else {
          newPhotos.push(photo)
        }
      } else {
        newPhotos.push(photo)
      }
    }
    json.conditionalPhotos = newPhotos
  }

  // Migrar dataUrl (signature fields)
  if (typeof json.dataUrl === 'string' && (json.dataUrl as string).startsWith('data:image')) {
    const url = await uploadPhoto(json.dataUrl as string, `migration/cl${row.checklist_id}/field_${row.field_id}_signature`)
    if (url) {
      json.dataUrl = url
      changed = true
      console.log(`  ✓ signature uploaded`)
    }
  }

  if (changed) {
    const { error } = await supabase
      .from('checklist_responses')
      .update({ value_json: json })
      .eq('id', row.id)

    if (error) {
      console.error(`  ✗ DB update failed for row ${row.id}:`, error.message)
    } else {
      console.log(`  ✓ row ${row.id} updated`)
    }
  }
}

async function main() {
  console.log('=== Migrando base64 para Storage ===\n')

  // Buscar todos os registros com base64
  const { data: rows, error } = await supabase
    .from('checklist_responses')
    .select('id, field_id, checklist_id, value_json')
    .not('value_json', 'is', null)

  if (error) {
    console.error('Erro ao buscar registros:', error)
    process.exit(1)
  }

  const base64Rows = (rows || []).filter(r =>
    JSON.stringify(r.value_json).includes('data:image')
  )

  console.log(`Total de registros: ${rows?.length || 0}`)
  console.log(`Registros com base64: ${base64Rows.length}`)
  console.log(`Tamanho estimado: ${Math.round(base64Rows.reduce((sum, r) => sum + JSON.stringify(r.value_json).length, 0) / 1024 / 1024)} MB\n`)

  let migrated = 0
  for (const row of base64Rows) {
    console.log(`[${migrated + 1}/${base64Rows.length}] Row ${row.id} (field ${row.field_id}, checklist ${row.checklist_id})`)
    await migrateRow(row as { id: number; field_id: number; checklist_id: number; value_json: Record<string, unknown> })
    migrated++
  }

  console.log(`\n=== Migracao completa: ${migrated} registros processados ===`)
  console.log('Execute VACUUM FULL checklist_responses no banco para liberar espaco.')
}

main().catch(console.error)
