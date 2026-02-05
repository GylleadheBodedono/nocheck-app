'use client'

import { createClient } from './supabase'
import {
  getPendingChecklists,
  updateChecklistStatus,
  deleteOfflineChecklist,
  type PendingChecklist,
} from './offlineStorage'
import { processarValidacaoCruzada } from './crossValidation'

let isSyncing = false
let syncListeners: Array<(status: SyncStatus) => void> = []

export type SyncStatus = {
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: string | null
  lastError: string | null
}

let currentStatus: SyncStatus = {
  isSyncing: false,
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener)
  listener(currentStatus) // Notify immediately with current status

  return () => {
    syncListeners = syncListeners.filter(l => l !== listener)
  }
}

/**
 * Notify all listeners of status change
 */
function notifyListeners() {
  syncListeners.forEach(listener => listener(currentStatus))
}

/**
 * Update sync status
 */
function updateStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates }
  notifyListeners()
}

/**
 * Sync a single checklist to the server
 */
async function syncChecklist(checklist: PendingChecklist): Promise<boolean> {
  const supabase = createClient()

  try {
    await updateChecklistStatus(checklist.id, 'syncing')

    // 1. Create the checklist record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newChecklist, error: checklistError } = await (supabase as any)
      .from('checklists')
      .insert({
        template_id: checklist.templateId,
        store_id: checklist.storeId,
        sector_id: checklist.sectorId,
        created_by: checklist.userId,
        status: 'concluido',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (checklistError) throw checklistError

    // 2. Create responses
    const responseRows = checklist.responses.map(r => ({
      checklist_id: newChecklist.id,
      field_id: r.fieldId,
      value_text: r.valueText,
      value_number: r.valueNumber,
      value_json: r.valueJson,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: responsesError } = await (supabase as any)
      .from('checklist_responses')
      .insert(responseRows)

    if (responsesError) throw responsesError

    // 3. Log activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('activity_log').insert({
      user_id: checklist.userId,
      store_id: checklist.storeId,
      checklist_id: newChecklist.id,
      action: 'checklist_synced',
      details: { synced_from: 'offline', original_date: checklist.createdAt },
    })

    // 4. Process cross validation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: template } = await (supabase as any)
      .from('checklist_templates')
      .select('*, fields:template_fields(*)')
      .eq('id', checklist.templateId)
      .single()

    if (template) {
      await processarValidacaoCruzada(
        supabase,
        newChecklist.id,
        checklist.templateId,
        checklist.storeId,
        checklist.userId,
        checklist.responses.map(r => ({
          field_id: r.fieldId,
          value_text: r.valueText,
          value_number: r.valueNumber,
          value_json: r.valueJson,
        })),
        template.fields || []
      )
    }

    // 5. Delete from offline storage
    await deleteOfflineChecklist(checklist.id)

    console.log('[Sync] Checklist synced successfully:', checklist.id)
    return true
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[Sync] Error syncing checklist:', err)
    await updateChecklistStatus(checklist.id, 'failed', errorMessage)
    return false
  }
}

/**
 * Sync all pending checklists
 */
export async function syncAll(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping...')
    return { synced: 0, failed: 0 }
  }

  if (!navigator.onLine) {
    console.log('[Sync] Offline, skipping sync...')
    updateStatus({ lastError: 'Sem conexão com a internet' })
    return { synced: 0, failed: 0 }
  }

  isSyncing = true
  updateStatus({ isSyncing: true, lastError: null })

  const pending = await getPendingChecklists()
  const pendingOnly = pending.filter(c => c.syncStatus === 'pending' || c.syncStatus === 'failed')

  let synced = 0
  let failed = 0

  for (const checklist of pendingOnly) {
    const success = await syncChecklist(checklist)
    if (success) {
      synced++
    } else {
      failed++
    }
  }

  // Update pending count
  const remainingPending = await getPendingChecklists()

  isSyncing = false
  updateStatus({
    isSyncing: false,
    pendingCount: remainingPending.length,
    lastSyncAt: new Date().toISOString(),
    lastError: failed > 0 ? `${failed} checklist(s) falharam` : null,
  })

  console.log(`[Sync] Complete: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

/**
 * Initialize sync service - sets up online listener
 */
export function initSyncService(): () => void {
  // Sync when coming back online
  const handleOnline = () => {
    console.log('[Sync] Back online, starting sync...')
    syncAll()
  }

  window.addEventListener('online', handleOnline)

  // Update pending count on init
  getPendingChecklists().then(pending => {
    updateStatus({ pendingCount: pending.length })
  })

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline)
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return currentStatus
}
