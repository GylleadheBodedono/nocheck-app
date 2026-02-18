'use client'

import { useEffect, useState, useRef, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FieldRenderer } from '@/components/fields/FieldRenderer'
import Link from 'next/link'
import {
  FiArrowLeft,
  FiCheckCircle,
  FiAlertCircle,
  FiCloudOff,
  FiMapPin,
  FiLayers,
  FiChevronRight,
  FiCloud,
  FiLoader,
} from 'react-icons/fi'
import type { ChecklistTemplate, TemplateField, Store, TemplateSection } from '@/types/database'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import { processarValidacaoCruzada } from '@/lib/crossValidation'
import { processarNaoConformidades } from '@/lib/actionPlanEngine'
import { saveOfflineChecklist, updateChecklistStatus, getPendingChecklists, updateOfflineFieldResponse, putOfflineChecklist, getOfflineChecklist } from '@/lib/offlineStorage'
import { getTemplatesCache, getStoresCache, getTemplateFieldsCache, getAuthCache, getTemplateSectionsCache } from '@/lib/offlineCache'
import { useDebouncedCallback } from 'use-debounce'

type FieldWithSection = TemplateField & { section_id: number | null }

type TemplateWithFields = ChecklistTemplate & {
  fields: FieldWithSection[]
  sections?: TemplateSection[]
}

type SectionProgress = {
  section_id: number
  status: 'pendente' | 'concluido'
  completed_at: string | null
  db_id?: number
}

// Upload photo helper
async function uploadPhoto(base64Image: string, fileName: string, folder?: string): Promise<string | null> {
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image, fileName, folder }),
    })
    const result = await response.json()
    if (!response.ok) return null
    if (result.success && result.url) return result.url
    return null
  } catch {
    return null
  }
}

// Haversine formula
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

type GpsStatus = 'loading' | 'granted' | 'denied' | 'too_far'

function ChecklistForm() {
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')
  const storeId = searchParams.get('store')
  const resumeId = searchParams.get('resume') // checklist id to resume

  const [template, setTemplate] = useState<TemplateWithFields | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [responses, setResponses] = useState<Record<number, unknown>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('loading')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [distanceToStore, setDistanceToStore] = useState<number | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Section-specific state
  const [hasSections, setHasSections] = useState(false)
  const [sortedSections, setSortedSections] = useState<TemplateSection[]>([])
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([])
  const [activeSection, setActiveSection] = useState<number | null>(null) // section_id being filled
  const [checklistId, setChecklistId] = useState<number | null>(null) // DB checklist id for sectioned mode
  const [offlineChecklistId, setOfflineChecklistId] = useState<string | null>(null) // Offline UUID for sectioned mode

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savedOffline, _setSavedOffline] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get fields for a specific section
  const getFieldsForSection = useCallback((sectionId: number): FieldWithSection[] => {
    if (!template) return []
    return template.fields
      .filter(f => f.section_id === sectionId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [template])

  useEffect(() => {
    const fetchData = async () => {
      if (!templateId || !storeId) {
        router.push(APP_CONFIG.routes.dashboard)
        return
      }

      if (!navigator.onLine) {
        await loadFromCache()
        return
      }

      // Fetch template with sections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: templateData } = await (supabase as any)
        .from('checklist_templates')
        .select(`
          *,
          fields:template_fields(*),
          sections:template_sections(*)
        `)
        .eq('id', templateId)
        .single()

      if (templateData) {
        const tData = templateData as TemplateWithFields
        tData.fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        const sections = (tData.sections || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        tData.sections = sections
        setTemplate(tData)

        if (sections.length > 0) {
          setHasSections(true)
          setSortedSections(sections)
        }
      }

      // Fetch store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: storeData } = await (supabase as any)
        .from('stores')
        .select('*')
        .eq('id', storeId)
        .single()

      if (storeData) setStore(storeData as Store)

      setLoading(false)
    }

    const loadFromCache = async () => {
      try {
        const cachedTemplates = await getTemplatesCache()
        const cachedTemplate = cachedTemplates.find(t => t.id === Number(templateId))
        if (cachedTemplate) {
          const cachedFields = await getTemplateFieldsCache(Number(templateId))
          cachedFields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

          // Load template sections from cache
          const allCachedSections = await getTemplateSectionsCache()
          const templateSections = allCachedSections
            .filter(s => s.template_id === Number(templateId))
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

          const tData = {
            ...cachedTemplate,
            fields: cachedFields as FieldWithSection[],
            sections: templateSections as TemplateSection[],
          } as TemplateWithFields
          setTemplate(tData)

          if (templateSections.length > 0) {
            setHasSections(true)
            setSortedSections(templateSections as TemplateSection[])
          }
        }
        const cachedStores = await getStoresCache()
        const cachedStore = cachedStores.find(s => s.id === Number(storeId))
        if (cachedStore) setStore(cachedStore as Store)
        setLoading(false)
      } catch (error) {
        console.error('[Checklist] Erro ao carregar cache:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [templateId, storeId, supabase, router])

  // After template loads with sections: check for existing in-progress checklist or create new one
  useEffect(() => {
    if (!hasSections || !template || loading || !store) return

    const initSectionedChecklist = async () => {
      let userId: string | null = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      } catch { /* offline */ }
      if (!userId) {
        const cachedAuth = await getAuthCache()
        userId = cachedAuth?.userId || null
      }
      if (!userId) return

      // If resuming a specific checklist
      if (resumeId) {
        if (navigator.onLine) {
          await loadExistingChecklist(Number(resumeId))
        }
        return
      }

      // === OFFLINE MODE: create or resume local sectioned checklist ===
      if (!navigator.onLine) {
        // Check for existing offline pending sectioned checklist (same template/store/user)
        const pendingOffline = await getPendingChecklists()
        const existingOffline = pendingOffline.find(c =>
          c.templateId === Number(templateId) &&
          c.storeId === Number(storeId) &&
          c.userId === userId &&
          c.sections && c.sections.length > 0 &&
          !c.sections.every(s => s.status === 'concluido')
        )

        if (existingOffline) {
          // Resume existing offline checklist
          setOfflineChecklistId(existingOffline.id)
          setSectionProgress(existingOffline.sections!.map(s => ({
            section_id: s.sectionId,
            status: s.status,
            completed_at: s.completedAt,
          })))
        } else {
          // Create new offline sectioned checklist
          const sectionEntries = sortedSections.map(s => ({
            sectionId: s.id,
            status: 'pendente' as const,
            completedAt: null,
            responses: [] as Array<{ fieldId: number; valueText: string | null; valueNumber: number | null; valueJson: unknown }>,
          }))

          const offlineId = await saveOfflineChecklist({
            templateId: Number(templateId),
            storeId: Number(storeId),
            sectorId: null,
            userId,
            responses: [],
            sections: sectionEntries,
          })

          // Don't sync until all sections are complete - set to 'syncing' so syncAll skips it
          await updateChecklistStatus(offlineId, 'syncing')

          setOfflineChecklistId(offlineId)
          setSectionProgress(sortedSections.map(s => ({
            section_id: s.id,
            status: 'pendente' as const,
            completed_at: null,
          })))
        }
        return
      }

      // === ONLINE MODE ===
      // Check for existing em_andamento checklist for this template+store+user today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('checklists')
        .select('id')
        .eq('template_id', Number(templateId))
        .eq('store_id', Number(storeId))
        .eq('created_by', userId)
        .eq('status', 'em_andamento')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (existing && existing.length > 0) {
        await loadExistingChecklist(existing[0].id)
      } else {
        // Create new checklist with em_andamento status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newChecklist, error: createErr } = await (supabase as any)
          .from('checklists')
          .insert({
            template_id: Number(templateId),
            store_id: Number(storeId),
            status: 'em_andamento',
            created_by: userId,
            started_at: new Date().toISOString(),
            latitude: userLocation?.lat ?? null,
            longitude: userLocation?.lng ?? null,
            accuracy: userLocation?.accuracy ?? null,
          })
          .select()
          .single()

        if (createErr) {
          console.error('[Checklist] Erro ao criar checklist:', createErr)
          return
        }

        setChecklistId(newChecklist.id)

        // Create checklist_sections entries (all pendente)
        const sectionRows = sortedSections.map(s => ({
          checklist_id: newChecklist.id,
          section_id: s.id,
          status: 'pendente',
        }))

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sectionData } = await (supabase as any)
          .from('checklist_sections')
          .insert(sectionRows)
          .select()

        if (sectionData) {
          setSectionProgress(sectionData.map((s: { id: number; section_id: number; status: string; completed_at: string | null }) => ({
            section_id: s.section_id,
            status: s.status as 'pendente' | 'concluido',
            completed_at: s.completed_at,
            db_id: s.id,
          })))
        }
      }
    }

    initSectionedChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSections, template, loading, store])

  const loadExistingChecklist = async (clId: number) => {
    // Verificar se checklist ja foi finalizado - redirecionar para view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clData } = await (supabase as any)
      .from('checklists')
      .select('status')
      .eq('id', clId)
      .single()

    if (clData?.status === 'concluido' || clData?.status === 'validado') {
      router.push(`/checklist/${clId}`)
      return
    }

    setChecklistId(clId)

    // Load checklist_sections progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: csData } = await (supabase as any)
      .from('checklist_sections')
      .select('*')
      .eq('checklist_id', clId)

    if (csData) {
      setSectionProgress(csData.map((s: { id: number; section_id: number; status: string; completed_at: string | null }) => ({
        section_id: s.section_id,
        status: s.status as 'pendente' | 'concluido',
        completed_at: s.completed_at,
        db_id: s.id,
      })))
    }

    // Load existing responses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: respData } = await (supabase as any)
      .from('checklist_responses')
      .select('field_id, value_text, value_number, value_json')
      .eq('checklist_id', clId)

    if (respData) {
      const restoredResponses: Record<number, unknown> = {}
      for (const r of respData) {
        const field = template?.fields.find(f => f.id === r.field_id)
        if (!field) continue
        switch (field.field_type) {
          case 'number':
            if (r.value_json && typeof r.value_json === 'object' && 'subtype' in (r.value_json as Record<string, unknown>)) {
              restoredResponses[r.field_id] = { subtype: (r.value_json as Record<string, unknown>).subtype, number: r.value_number }
            } else {
              restoredResponses[r.field_id] = r.value_number
            }
            break
          case 'calculated':
            restoredResponses[r.field_id] = r.value_number
            break
          case 'photo': {
            const json = r.value_json as { photos?: string[] } | null
            restoredResponses[r.field_id] = json?.photos || []
            break
          }
          case 'yes_no': {
            const yJson = r.value_json as { photos?: string[] } | null
            if (yJson?.photos && yJson.photos.length > 0) {
              restoredResponses[r.field_id] = { answer: r.value_text || '', photos: yJson.photos }
            } else {
              restoredResponses[r.field_id] = r.value_text
            }
            break
          }
          case 'checkbox_multiple':
          case 'signature':
          case 'gps':
            restoredResponses[r.field_id] = r.value_json
            break
          default:
            restoredResponses[r.field_id] = r.value_text
        }
      }
      setResponses(restoredResponses)
    }
  }

  // GPS auto-collection
  useEffect(() => {
    if (!store || loading) return
    // Offline: pular GPS para permitir preenchimento
    if (!navigator.onLine) { setGpsStatus('granted'); return }
    if (store.require_gps === false) { setGpsStatus('granted'); return }
    if (!navigator.geolocation) { setGpsStatus('denied'); return }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setUserLocation({ lat: latitude, lng: longitude, accuracy })
        if (store.latitude && store.longitude) {
          const distance = getDistanceMeters(latitude, longitude, store.latitude, store.longitude)
          setDistanceToStore(Math.round(distance))
          setGpsStatus(distance > 100 ? 'too_far' : 'granted')
        } else {
          setGpsStatus('granted')
        }
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }, [store, loading])

  // For NON-SECTIONED templates: create em_andamento checklist on mount so auto-save has a checklistId
  useEffect(() => {
    if (hasSections || !template || loading || !store) return
    if (checklistId || offlineChecklistId) return // already initialized

    const initNonSectionedChecklist = async () => {
      let userId: string | null = null
      try {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || null
      } catch { /* offline */ }
      if (!userId) {
        const cachedAuth = await getAuthCache()
        userId = cachedAuth?.userId || null
      }
      if (!userId) return

      // === OFFLINE ===
      if (!navigator.onLine) {
        const pendingOffline = await getPendingChecklists()
        const existingOffline = pendingOffline.find(c =>
          c.templateId === Number(templateId) &&
          c.storeId === Number(storeId) &&
          c.userId === userId &&
          (!c.sections || c.sections.length === 0) &&
          c.syncStatus === 'syncing'
        )

        if (existingOffline) {
          setOfflineChecklistId(existingOffline.id)
          // Restore responses
          const restoredResponses: Record<number, unknown> = {}
          for (const r of existingOffline.responses) {
            const field = template?.fields.find(f => f.id === r.fieldId)
            if (!field) continue
            if (field.field_type === 'photo') {
              const json = r.valueJson as { photos?: string[] } | null
              restoredResponses[r.fieldId] = json?.photos || []
            } else if (field.field_type === 'yes_no') {
              const json = r.valueJson as { photos?: string[] } | null
              if (json?.photos && json.photos.length > 0) {
                restoredResponses[r.fieldId] = { answer: r.valueText || '', photos: json.photos }
              } else {
                restoredResponses[r.fieldId] = r.valueText
              }
            } else if (['checkbox_multiple', 'signature', 'gps'].includes(field.field_type)) {
              restoredResponses[r.fieldId] = r.valueJson
            } else if (r.valueNumber !== null) {
              if (r.valueJson && typeof r.valueJson === 'object' && 'subtype' in (r.valueJson as Record<string, unknown>)) {
                restoredResponses[r.fieldId] = { subtype: (r.valueJson as Record<string, unknown>).subtype, number: r.valueNumber }
              } else {
                restoredResponses[r.fieldId] = r.valueNumber
              }
            } else if (r.valueText !== null) {
              restoredResponses[r.fieldId] = r.valueText
            }
          }
          if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
        } else {
          const offlineId = await saveOfflineChecklist({
            templateId: Number(templateId),
            storeId: Number(storeId),
            sectorId: null,
            userId,
            responses: [],
          })
          await updateChecklistStatus(offlineId, 'syncing') // guard: don't sync prematurely
          setOfflineChecklistId(offlineId)
        }
        return
      }

      // === ONLINE ===
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('checklists')
        .select('id')
        .eq('template_id', Number(templateId))
        .eq('store_id', Number(storeId))
        .eq('created_by', userId)
        .eq('status', 'em_andamento')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (existing && existing.length > 0) {
        await loadExistingChecklist(existing[0].id)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newChecklist, error: createErr } = await (supabase as any)
          .from('checklists')
          .insert({
            template_id: Number(templateId),
            store_id: Number(storeId),
            status: 'em_andamento',
            created_by: userId,
            started_at: new Date().toISOString(),
            latitude: userLocation?.lat ?? null,
            longitude: userLocation?.lng ?? null,
            accuracy: userLocation?.accuracy ?? null,
          })
          .select()
          .single()

        if (createErr) {
          console.error('[Checklist] Erro ao criar checklist:', createErr)
          return
        }
        setChecklistId(newChecklist.id)
      }
    }

    initNonSectionedChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSections, template, loading, store])

  // Build response data for a single field (no photo upload - photos stay as base64 during auto-save)
  const buildSingleResponseRow = useCallback((fieldId: number, value: unknown) => {
    if (value === undefined || value === null) return null
    const field = template?.fields.find(f => f.id === fieldId)
    if (!field) return null

    let valueText: string | null = null
    let valueNumber: number | null = null
    let valueJson: unknown = null

    if (field.field_type === 'number') {
      if (typeof value === 'object' && value !== null && 'number' in (value as Record<string, unknown>)) {
        const numObj = value as { subtype: string; number: number }
        valueNumber = numObj.number
        valueJson = { subtype: numObj.subtype }
      } else {
        valueNumber = value as number
      }
    } else if (field.field_type === 'calculated') {
      valueNumber = value as number
    } else if (field.field_type === 'photo') {
      const photos = value as string[]
      valueJson = { photos: photos || [], uploadedToDrive: false }
    } else if (field.field_type === 'yes_no') {
      if (typeof value === 'object' && value !== null && 'answer' in (value as Record<string, unknown>)) {
        const yesNoObj = value as { answer: string; photos?: string[] }
        valueText = yesNoObj.answer
        if (yesNoObj.photos && yesNoObj.photos.length > 0) {
          valueJson = { photos: yesNoObj.photos }
        }
      } else {
        valueText = value as string
      }
    } else if (['checkbox_multiple', 'signature', 'gps'].includes(field.field_type)) {
      valueJson = value
    } else {
      valueText = value as string
    }

    return { fieldId, valueText, valueNumber, valueJson }
  }, [template])

  // Debounced auto-save: saves a single field response after 1.5s of inactivity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoSaveField = useDebouncedCallback(async (fieldId: number, value: unknown) => {
    const row = buildSingleResponseRow(fieldId, value)
    if (!row) return

    setAutoSaveStatus('saving')
    try {
      if (navigator.onLine && checklistId) {
        // Online: upsert to checklist_responses
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id || null
        } catch { /* offline */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('checklist_responses')
          .upsert({
            checklist_id: checklistId,
            field_id: row.fieldId,
            value_text: row.valueText,
            value_number: row.valueNumber,
            value_json: row.valueJson,
            answered_by: userId,
          }, { onConflict: 'checklist_id,field_id' })
      } else if (offlineChecklistId) {
        // Offline: update in IndexedDB
        const field = template?.fields.find(f => f.id === fieldId)
        const sectionId = field?.section_id ?? null
        await updateOfflineFieldResponse(offlineChecklistId, sectionId, fieldId, {
          valueText: row.valueText,
          valueNumber: row.valueNumber,
          valueJson: row.valueJson,
        })
      }

      setAutoSaveStatus('saved')
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[AutoSave] Error:', err)
      setAutoSaveStatus('error')
    }
  }, 1500)

  const updateResponse = (fieldId: number, value: unknown) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    }
    // Trigger debounced auto-save
    autoSaveField(fieldId, value)
  }

  // Build response row data for a set of fields
  const buildResponseRows = async (fieldIds: number[], attemptUpload: boolean) => {
    const rows: Array<{ fieldId: number; valueText: string | null; valueNumber: number | null; valueJson: unknown }> = []

    for (const fieldId of fieldIds) {
      const value = responses[fieldId]
      if (value === undefined || value === null) continue
      const field = template?.fields.find(f => f.id === fieldId)
      if (!field) continue

      let valueText = null
      let valueNumber = null
      let valueJson = null

      if (field.field_type === 'number') {
        if (typeof value === 'object' && value !== null && 'number' in (value as Record<string, unknown>)) {
          const numObj = value as { subtype: string; number: number }
          valueNumber = numObj.number
          valueJson = { subtype: numObj.subtype }
        } else {
          valueNumber = value as number
        }
      } else if (field.field_type === 'calculated') {
        valueNumber = value as number
      } else if (field.field_type === 'photo') {
        const photos = value as string[]
        if (photos && photos.length > 0 && attemptUpload) {
          const uploadedUrls: string[] = []
          for (let i = 0; i < photos.length; i++) {
            const url = await uploadPhoto(photos[i], `checklist_${Date.now()}_foto_${i + 1}.jpg`)
            uploadedUrls.push(url || photos[i])
          }
          valueJson = { photos: uploadedUrls, uploadedToDrive: uploadedUrls.some(u => u.startsWith('http')) }
        } else {
          valueJson = { photos: photos || [], uploadedToDrive: false }
        }
      } else if (field.field_type === 'yes_no') {
        // yes_no can be string (legacy) or { answer, photos }
        if (typeof value === 'object' && value !== null && 'answer' in (value as Record<string, unknown>)) {
          const yesNoObj = value as { answer: string; photos?: string[] }
          valueText = yesNoObj.answer
          if (yesNoObj.photos && yesNoObj.photos.length > 0 && attemptUpload) {
            const uploadedUrls: string[] = []
            for (let i = 0; i < yesNoObj.photos.length; i++) {
              const url = await uploadPhoto(yesNoObj.photos[i], `checklist_${Date.now()}_yesno_foto_${i + 1}.jpg`, 'anexos')
              uploadedUrls.push(url || yesNoObj.photos[i])
            }
            valueJson = { photos: uploadedUrls }
          } else if (yesNoObj.photos && yesNoObj.photos.length > 0) {
            valueJson = { photos: yesNoObj.photos }
          }
        } else {
          valueText = value as string
        }
      } else if (['checkbox_multiple', 'signature', 'gps'].includes(field.field_type)) {
        valueJson = value
      } else {
        valueText = value as string
      }

      rows.push({ fieldId, valueText, valueNumber, valueJson })
    }

    return rows
  }

  // Validate a set of fields
  const validateFields = (fieldIds: number[]): boolean => {
    const newErrors: Record<number, string> = {}
    for (const fieldId of fieldIds) {
      const field = template?.fields.find(f => f.id === fieldId)
      if (!field || field.field_type === 'gps') continue
      if (field.is_required) {
        const value = responses[fieldId]
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          newErrors[fieldId] = 'Este campo e obrigatorio'
        }
        // For yes_no with required answer: check answer exists
        if (field.field_type === 'yes_no' && typeof value === 'object' && value !== null) {
          const ans = (value as Record<string, unknown>).answer
          if (!ans || ans === '') {
            newErrors[fieldId] = 'Este campo e obrigatorio'
          }
        }
      }
      // Photo required validation for yes_no fields
      if (field.field_type === 'yes_no' && (field.options as { photoRequired?: boolean } | null)?.photoRequired) {
        const value = responses[fieldId]
        const hasPhotos = typeof value === 'object' && value !== null && 'photos' in (value as Record<string, unknown>) && ((value as Record<string, unknown>).photos as string[]).length > 0
        if (!hasPhotos) {
          newErrors[fieldId] = 'Foto obrigatoria para este campo'
        }
      }
    }
    setErrors(prev => ({ ...prev, ...newErrors }))
    return Object.keys(newErrors).length === 0
  }

  // === SECTION BACK: auto-mark section as complete if all required fields are filled ===
  const handleSectionBack = async () => {
    // Flush pending auto-save
    autoSaveField.flush()

    if (activeSection === null) { setActiveSection(null); return }

    const sectionFields = getFieldsForSection(activeSection)
    const requiredFieldIds = sectionFields
      .filter(f => f.is_required && f.field_type !== 'gps')
      .map(f => f.id)

    // Check if all required fields are filled
    const allRequiredFilled = requiredFieldIds.every(id => {
      const v = responses[id]
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false
      if (typeof v === 'object' && v !== null && 'answer' in (v as Record<string, unknown>)) {
        const ans = (v as Record<string, unknown>).answer
        if (!ans || ans === '') return false
      }
      return true
    })

    // Has at least one response in this section
    const hasAnyResponse = sectionFields.some(f => {
      const v = responses[f.id]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    })

    if (allRequiredFilled && hasAnyResponse) {
      try {
        if (navigator.onLine && checklistId) {
          const sectionProg = sectionProgress.find(sp => sp.section_id === activeSection)
          if (sectionProg?.db_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('checklist_sections')
              .update({ status: 'concluido', completed_at: new Date().toISOString() })
              .eq('id', sectionProg.db_id)
          }
        } else if (offlineChecklistId) {
          const cl = await getOfflineChecklist(offlineChecklistId)
          if (cl?.sections) {
            cl.sections = cl.sections.map(s =>
              s.sectionId === activeSection
                ? { ...s, status: 'concluido' as const, completedAt: new Date().toISOString() }
                : s
            )
            await putOfflineChecklist(cl)
          }
        }

        setSectionProgress(prev => prev.map(sp =>
          sp.section_id === activeSection
            ? { ...sp, status: 'concluido' as const, completed_at: new Date().toISOString() }
            : sp
        ))
      } catch (err) {
        console.error('[Checklist] Erro ao marcar secao como concluida:', err)
      }
    }

    setActiveSection(null)
  }

  // === UPLOAD PENDING PHOTOS (base64 → cloud) ===
  const uploadPendingPhotos = async (clId: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: respData } = await (supabase as any)
      .from('checklist_responses')
      .select('id, field_id, value_json')
      .eq('checklist_id', clId)

    if (!respData) return

    for (const r of respData) {
      const json = r.value_json as { photos?: string[] } | null
      if (!json?.photos) continue
      const hasBase64 = json.photos.some((p: string) => p.startsWith('data:'))
      if (!hasBase64) continue

      const uploadedUrls: string[] = []
      for (let i = 0; i < json.photos.length; i++) {
        if (json.photos[i].startsWith('data:')) {
          const url = await uploadPhoto(json.photos[i], `checklist_${clId}_field_${r.field_id}_foto_${i + 1}.jpg`)
          uploadedUrls.push(url || json.photos[i])
        } else {
          uploadedUrls.push(json.photos[i])
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('checklist_responses')
        .update({ value_json: { photos: uploadedUrls, uploadedToDrive: true } })
        .eq('id', r.id)
    }
  }

  // === FINALIZE CHECKLIST (both sectioned and non-sectioned) ===
  const handleFinalizeChecklist = async () => {
    // Finalizar exige internet
    if (!navigator.onLine) {
      setErrors({ 0: 'Voce precisa estar conectado a internet para finalizar o checklist. Suas respostas estao salvas e voce pode finalizar quando estiver online.' })
      return
    }

    setSubmitting(true)

    let userId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch { /* offline */ }
    if (!userId) {
      const cachedAuth = await getAuthCache()
      userId = cachedAuth?.userId || null
    }
    if (!userId) {
      setErrors({ 0: 'Usuario nao autenticado.' })
      setSubmitting(false)
      return
    }

    try {
      // === ONLINE ===
      if (checklistId) {
        // Upload pending photos (base64 → cloud)
        await uploadPendingPhotos(checklistId)

        // Finalize checklist status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('checklists')
          .update({ status: 'concluido', completed_at: new Date().toISOString() })
          .eq('id', checklistId)

        // Process cross validation + non-conformity
        if (template) {
          const allFieldIds = template.fields.map(f => f.id)
          const allResponseData = await buildResponseRows(allFieldIds, false)
          const allResponseMapped = allResponseData.map(r => ({
            field_id: r.fieldId,
            value_text: r.valueText,
            value_number: r.valueNumber,
            value_json: r.valueJson,
          }))
          await processarValidacaoCruzada(
            supabase,
            checklistId,
            Number(templateId),
            Number(storeId),
            userId,
            allResponseMapped,
            template.fields
          )
          await processarNaoConformidades(
            supabase,
            checklistId,
            Number(templateId),
            Number(storeId),
            null,
            userId,
            allResponseMapped,
            template.fields.map(f => ({ id: f.id, name: f.name, field_type: f.field_type, options: f.options }))
          )
        }

        // Activity log
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('activity_log').insert({
          store_id: Number(storeId),
          user_id: userId,
          checklist_id: checklistId,
          action: 'checklist_concluido',
          details: { template_name: template?.name },
        })

        setSuccess(true)
        setTimeout(() => router.push(APP_CONFIG.routes.dashboard), 2000)
      }
    } catch (err) {
      console.error('[Checklist] Erro ao finalizar:', err)
      setErrors({ 0: err instanceof Error ? err.message : 'Erro ao finalizar checklist' })
      setSubmitting(false)
    }
  }

  // === FINALIZE (non-sectioned templates) ===
  // With auto-save, responses are already saved. This validates + calls handleFinalizeChecklist.
  const handleNonSectionedFinalize = async () => {
    // Flush pending auto-save
    autoSaveField.flush()

    const allFieldIds = (template?.fields || []).filter(f => f.field_type !== 'gps').map(f => f.id)
    if (!validateFields(allFieldIds)) {
      const firstErrorId = Object.keys(errors)[0]
      document.getElementById(`field-${firstErrorId}`)?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    // Delegate to shared finalize handler (checks internet, marks concluido, etc.)
    await handleFinalizeChecklist()
  }

  // ========== RENDER ==========

  if (loading) return <LoadingPage />

  if (!template || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-main">Checklist nao encontrado</p>
          <Link href={APP_CONFIG.routes.dashboard} className="text-primary mt-4 inline-block hover:underline">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    const allDone = !hasSections || sectionProgress.every(sp => sp.status === 'concluido')
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${savedOffline ? 'bg-warning/20' : 'bg-primary/20'}`}>
            {savedOffline ? <FiCloudOff className="w-10 h-10 text-warning" /> : <FiCheckCircle className="w-10 h-10 text-primary" />}
          </div>
          <h2 className="text-2xl font-bold text-main mb-2">
            {savedOffline ? 'Salvo Offline' : allDone ? APP_CONFIG.messages.checklistSent : 'Secao Salva'}
          </h2>
          <p className="text-muted">
            {savedOffline ? 'O checklist sera enviado quando voce estiver online.' : APP_CONFIG.messages.redirecting}
          </p>
        </div>
      </div>
    )
  }

  // GPS blocking screens
  if (gpsStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center px-8">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-main mb-2">Obtendo localizacao...</h2>
          <p className="text-muted text-sm">Permita o acesso a localizacao para continuar</p>
        </div>
      </div>
    )
  }

  if (gpsStatus === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center px-8">
          <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="w-10 h-10 text-error" />
          </div>
          <h2 className="text-xl font-bold text-main mb-2">Localizacao necessaria</h2>
          <p className="text-muted text-sm mb-6">Ative a permissao de GPS nas configuracoes do navegador.</p>
          <Link href={APP_CONFIG.routes.dashboard} className="btn-primary inline-flex items-center gap-2 px-6 py-3">
            <FiArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (gpsStatus === 'too_far') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center px-8">
          <div className="w-20 h-20 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <FiMapPin className="w-10 h-10 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-main mb-2">Voce esta longe da loja</h2>
          <p className="text-muted text-sm mb-2">Voce precisa estar proximo da loja para preencher o checklist.</p>
          <p className="text-muted text-xs mb-6">Distancia atual: {distanceToStore}m (maximo: 100m)</p>
          <Link href={APP_CONFIG.routes.dashboard} className="btn-primary inline-flex items-center gap-2 px-6 py-3">
            <FiArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ============ SECTIONED TEMPLATE: SECTION LIST VIEW ============
  if (hasSections && activeSection === null) {
    const completedCount = sectionProgress.filter(sp => sp.status === 'concluido').length
    const totalCount = sortedSections.length
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
      <div className="min-h-screen bg-page">
        <Header
          backHref={APP_CONFIG.routes.dashboard}
          title={template.name}
          subtitle={store.name}
          icon={FiLayers}
          rightSlot={
            <div className="text-right">
              <p className="text-xs sm:text-sm font-medium text-primary">{completedCount}/{totalCount}</p>
              <p className="text-[10px] sm:text-xs text-muted">etapas</p>
            </div>
          }
        >
          <div className="h-1 bg-surface-hover">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </Header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-6">
            <FiLayers className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-main">Etapas do Checklist</h2>
          </div>

          <div className="space-y-3">
            {sortedSections.map((section, idx) => {
              const progress = sectionProgress.find(sp => sp.section_id === section.id)
              const isDone = progress?.status === 'concluido'
              const sectionFields = getFieldsForSection(section.id)

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left card p-3 sm:p-5 transition-all hover:shadow-theme-md cursor-pointer ${
                    isDone
                      ? 'border-success/30 hover:border-success/50'
                      : 'border-subtle hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                      isDone ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'
                    }`}>
                      {isDone ? <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm sm:text-base ${isDone ? 'text-success' : 'text-main'}`}>
                        {section.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted">
                        {sectionFields.length} campo{sectionFields.length !== 1 ? 's' : ''}
                        {isDone && progress?.completed_at && (
                          <> &middot; {new Date(progress.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                        )}
                      </p>
                    </div>
                    <FiChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isDone ? 'text-success' : 'text-muted'}`} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Finalizar Checklist button: always visible */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handleFinalizeChecklist}
              disabled={submitting}
              className="btn-primary w-full py-4 text-base font-semibold rounded-2xl shadow-theme-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Finalizando...</>
              ) : (
                <><FiCheckCircle className="w-5 h-5" /> Finalizar Checklist</>
              )}
            </button>
          </div>

          <div className="mt-4">
            <Link href={APP_CONFIG.routes.dashboard} className="btn-ghost w-full py-3 text-center block">
              Voltar ao Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // ============ SECTIONED TEMPLATE: FILLING A SPECIFIC SECTION ============
  if (hasSections && activeSection !== null) {
    const section = sortedSections.find(s => s.id === activeSection)
    const sectionFields = getFieldsForSection(activeSection).filter(f => f.field_type !== 'gps')
    const progress = sectionProgress.find(sp => sp.section_id === activeSection)
    const isDone = progress?.status === 'concluido'

    const filledCount = sectionFields.filter(f => {
      const v = responses[f.id]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    }).length
    const progressPct = sectionFields.length > 0 ? Math.round((filledCount / sectionFields.length) * 100) : 0

    return (
      <div className="min-h-screen bg-page">
        <Header
          onBack={handleSectionBack}
          title={section?.name}
          subtitle={template.name}
          icon={FiLayers}
          rightSlot={
            <div className="text-right">
              <p className="text-xs sm:text-sm font-medium text-primary">{progressPct}%</p>
              <p className="text-[10px] sm:text-xs text-muted">completo</p>
            </div>
          }
        >
          <div className="h-1 bg-surface-hover">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </Header>

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="space-y-6">
              {isDone && (
                <div className="p-2.5 sm:p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2 text-xs sm:text-sm text-success">
                  <FiCheckCircle className="w-4 h-4 shrink-0" />
                  <span>Etapa concluida — alteracoes sao salvas automaticamente</span>
                </div>
              )}
              {sectionFields.map((field, index) => (
                <div
                  key={field.id}
                  id={`field-${field.id}`}
                  className={`card p-4 sm:p-6 transition-all ${errors[field.id] ? 'border-red-500/50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-muted">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-surface-hover flex items-center justify-center text-[10px] sm:text-xs">{index + 1}</span>
                    <span>de {sectionFields.length}</span>
                  </div>
                  <FieldRenderer field={field} value={responses[field.id]} onChange={(value) => updateResponse(field.id, value)} error={errors[field.id]} />
                </div>
              ))}

              {errors[0] && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400">{errors[0]}</p>
                </div>
              )}

              {/* Auto-save status indicator */}
              <div className="sticky bottom-4 flex justify-center">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium backdrop-blur-sm transition-all duration-300 ${
                  autoSaveStatus === 'saving' ? 'bg-primary/10 text-primary border border-primary/20' :
                  autoSaveStatus === 'saved' ? 'bg-success/10 text-success border border-success/20' :
                  autoSaveStatus === 'error' ? 'bg-error/10 text-error border border-error/20' :
                  'bg-surface/80 text-muted border border-subtle opacity-0'
                }`}>
                  {autoSaveStatus === 'saving' && <><FiLoader className="w-3.5 h-3.5 animate-spin" /> Salvando...</>}
                  {autoSaveStatus === 'saved' && <><FiCloud className="w-3.5 h-3.5" /> Salvo</>}
                  {autoSaveStatus === 'error' && <><FiAlertCircle className="w-3.5 h-3.5" /> Erro ao salvar</>}
                </div>
              </div>
            </div>
        </main>
      </div>
    )
  }

  // ============ NON-SECTIONED TEMPLATE: ORIGINAL LINEAR FORM ============
  const visibleFields = template.fields.filter(f => f.field_type !== 'gps')

  const progress = visibleFields.length > 0
    ? Math.round((Object.keys(responses).filter(k => {
        const v = responses[Number(k)]
        return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      }).length / visibleFields.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-page">
      <Header
        backHref={APP_CONFIG.routes.dashboard}
        title={template.name}
        subtitle={store.name}
        icon={FiLayers}
        rightSlot={
          <div className="text-right">
            <p className="text-xs sm:text-sm font-medium text-primary">{progress}%</p>
            <p className="text-[10px] sm:text-xs text-muted">completo</p>
          </div>
        }
      >
        <div className="h-1 bg-surface-hover">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </Header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {visibleFields.map((field, index) => (
            <div
              key={field.id}
              id={`field-${field.id}`}
              className={`card p-4 sm:p-6 transition-all ${errors[field.id] ? 'border-red-500/50' : ''}`}
            >
              <div className="flex items-center gap-2 mb-3 sm:mb-4 text-xs sm:text-sm text-muted">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-surface-hover flex items-center justify-center text-[10px] sm:text-xs">{index + 1}</span>
                <span>de {visibleFields.length}</span>
              </div>
              <FieldRenderer field={field} value={responses[field.id]} onChange={(value) => updateResponse(field.id, value)} error={errors[field.id]} />
            </div>
          ))}

          {errors[0] && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400">{errors[0]}</p>
            </div>
          )}

          {/* Auto-save status indicator */}
          {autoSaveStatus !== 'idle' && (
            <div className="flex justify-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${
                autoSaveStatus === 'saving' ? 'bg-primary/10 text-primary border border-primary/20' :
                autoSaveStatus === 'saved' ? 'bg-success/10 text-success border border-success/20' :
                'bg-error/10 text-error border border-error/20'
              }`}>
                {autoSaveStatus === 'saving' && <><FiLoader className="w-3.5 h-3.5 animate-spin" /> Salvando...</>}
                {autoSaveStatus === 'saved' && <><FiCloud className="w-3.5 h-3.5" /> Salvo</>}
                {autoSaveStatus === 'error' && <><FiAlertCircle className="w-3.5 h-3.5" /> Erro ao salvar</>}
              </div>
            </div>
          )}

          <div className="sticky bottom-4 space-y-3">
            <button
              type="button"
              onClick={handleNonSectionedFinalize}
              disabled={submitting}
              className="btn-primary w-full py-4 text-base font-semibold rounded-2xl shadow-theme-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Finalizando...</>
              ) : (
                <><FiCheckCircle className="w-5 h-5" /> Finalizar Checklist</>
              )}
            </button>
            <Link href={APP_CONFIG.routes.dashboard} className="btn-ghost w-full py-3 text-center block">
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function NovoChecklistPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <ChecklistForm />
    </Suspense>
  )
}
