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
  FiPlus,
} from 'react-icons/fi'
import type { ChecklistTemplate, TemplateField, Store, TemplateSection } from '@/types/database'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage } from '@/components/ui'
import { processarValidacaoCruzada } from '@/lib/crossValidation'
import { processarNaoConformidades } from '@/lib/actionPlanEngine'
import { saveOfflineChecklist, updateChecklistStatus, getPendingChecklists, updateOfflineFieldResponse, putOfflineChecklist, getOfflineChecklist, deleteOfflineChecklist, type PendingChecklist } from '@/lib/offlineStorage'
import { getTemplatesCache, getStoresCache, getTemplateFieldsCache, getAuthCache, getTemplateSectionsCache } from '@/lib/offlineCache'
import { useDebouncedCallback } from 'use-debounce'
import { isWithinTimeRange } from '@/lib/timeUtils'

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
  const [activeParentSection, setActiveParentSection] = useState<number | null>(null) // parent section for sub-etapa navigation
  const [checklistId, setChecklistId] = useState<number | null>(null) // DB checklist id for sectioned mode
  const [offlineChecklistId, setOfflineChecklistId] = useState<string | null>(null) // Offline UUID for sectioned mode
  const checklistIdRef = useRef<number | null>(null)
  const offlineChecklistIdRef = useRef<string | null>(null)
  const responsesRef = useRef(responses)
  useEffect(() => { responsesRef.current = responses }, [responses])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [savedOffline, _setSavedOffline] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // Tech user: pode adicionar campos/etapas ao template
  const [isTechUser, setIsTechUser] = useState(false)
  const [showAddFieldModal, setShowAddFieldModal] = useState(false)
  const [addFieldSectionId, setAddFieldSectionId] = useState<number | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<'yes_no' | 'text' | 'number' | 'photo' | 'dropdown' | 'checkbox_multiple' | 'rating' | 'signature'>('yes_no')
  const [newFieldRequired, setNewFieldRequired] = useState(true)
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('')
  const [newFieldHelpText, setNewFieldHelpText] = useState('')
  const [newFieldOptions, setNewFieldOptions] = useState<string[]>([])
  const [newFieldOptionInput, setNewFieldOptionInput] = useState('')
  const [newFieldAllowPhoto, setNewFieldAllowPhoto] = useState(false)
  const [newFieldOnNo, setNewFieldOnNo] = useState({
    showTextField: false,
    textFieldRequired: false,
    showPhotoField: false,
    photoFieldRequired: false,
    allowUserActionPlan: false,
  })
  const [addingField, setAddingField] = useState(false)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializingRef = useRef(false) // Guard against double-init (StrictMode / fast re-renders)

  // Reset initializing guard on mount (handles case where previous unmount
  // interrupted async initialization, leaving ref stuck at true)
  useEffect(() => {
    initializingRef.current = false
    return () => { initializingRef.current = false }
  }, [])

  useEffect(() => { checklistIdRef.current = checklistId }, [checklistId])
  useEffect(() => { offlineChecklistIdRef.current = offlineChecklistId }, [offlineChecklistId])

  // Buscar is_tech do usuario para habilitar botao de adicionar campos
  useEffect(() => {
    const checkTech = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any).from('users').select('is_tech').eq('id', user.id).single()
        if (profile?.is_tech) setIsTechUser(true)
      } catch { /* nao critico */ }
    }
    checkTech()
  }, [supabase])

  // Time restriction states
  const [timeBlocked, setTimeBlocked] = useState(false)
  const [timeBlockedMessage, setTimeBlockedMessage] = useState('')
  const [justificationExpired, setJustificationExpired] = useState(false)
  const [justificationExpiredMessage, setJustificationExpiredMessage] = useState('')

  // Offline finalization modal
  const [showOfflineModal, setShowOfflineModal] = useState(false)

  // Justification states (for incomplete checklist finalization)
  const [showIncompleteModal, setShowIncompleteModal] = useState(false)
  const [showJustificationScreen, setShowJustificationScreen] = useState(false)
  const [emptyRequiredFields, setEmptyRequiredFields] = useState<FieldWithSection[]>([])
  const [justifications, setJustifications] = useState<Record<number, string>>({})

  // Get fields for a specific section
  const getFieldsForSection = useCallback((sectionId: number): FieldWithSection[] => {
    if (!template) return []
    return template.fields
      .filter(f => f.section_id === sectionId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [template])

  // Fields without a section (Campos Gerais)
  const generalFields = useMemo(() => {
    if (!template) return []
    return template.fields
      .filter(f => f.section_id === null && f.field_type !== 'gps')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [template])

  // ─── Hierarquia 3 niveis: Etapa > Sub-etapa > Campos ─────────────────────
  /** Etapas-pai: secoes sem parent_id que possuem filhas no template */
  const parentSections = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sectionsWithParent = sortedSections.filter((s: any) => s.parent_id != null)
    if (sectionsWithParent.length === 0) return [] // no hierarchy, use flat mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sortedSections.filter((s: any) => s.parent_id == null).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [sortedSections])

  // Whether this template uses the 3-level hierarchy (etapa > sub-etapa > campos)
  const hasSubSections = parentSections.length > 0

  // Get sub-sections (sub-etapas) for a given parent section
  const getSubSections = useCallback((parentId: number): TemplateSection[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return sortedSections.filter((s: any) => s.parent_id === parentId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [sortedSections])

  // For hierarchical templates: get all fields for a parent section (across all its sub-sections)
  const getFieldsForParentSection = useCallback((parentId: number): FieldWithSection[] => {
    const subSections = getSubSections(parentId)
    const subSectionIds = subSections.map(s => s.id)
    if (!template) return []
    return template.fields.filter(f => f.section_id != null && subSectionIds.includes(f.section_id))
  }, [template, getSubSections])

  // Flat sections (sections that are NOT parents in hierarchical mode) — used for section list in flat mode
  const flatSections = useMemo(() => {
    if (hasSubSections) {
      // In hierarchical mode, flat sections are the sub-etapas (have parent_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return sortedSections.filter((s: any) => s.parent_id != null)
    }
    return sortedSections
  }, [sortedSections, hasSubSections])

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
        // Verificar se template e restrito a administradores
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((templateData as any).admin_only) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: userData } = await (supabase as any).from('users').select('is_admin').eq('id', user.id).single()
            if (!userData?.is_admin) {
              setLoading(false)
              return // template nao sera setado → tela "nao encontrado"
            }
          }
        }

        const tData = templateData as TemplateWithFields
        tData.fields.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        const sections = (tData.sections || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        tData.sections = sections
        setTemplate(tData)

        if (sections.length > 0) {
          setHasSections(true)
          setSortedSections(sections)
        }

        // Check time restrictions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawTemplate = templateData as any
        if (rawTemplate.allowed_start_time && rawTemplate.allowed_end_time) {
          console.log(`[Checklist] Verificando horario — template: ${rawTemplate.name}, start: ${rawTemplate.allowed_start_time}, end: ${rawTemplate.allowed_end_time}`)
          // Check if admin has disabled time restrictions (global or per-store)
          let ignoreTime = false
          try {
            const settingsRes = await fetch('/api/settings?keys=ignore_time_restrictions,ignore_time_restrictions_stores', {
              headers: { 'x-supabase-auth': (await supabase.auth.getSession()).data.session?.access_token || '' },
            })
            if (settingsRes.ok) {
              const settings: { key: string; value: string }[] = await settingsRes.json()
              const toggleValue = settings.find(s => s.key === 'ignore_time_restrictions')?.value
              const storesValue = settings.find(s => s.key === 'ignore_time_restrictions_stores')?.value

              if (toggleValue === 'true') {
                if (!storesValue || storesValue === 'all') {
                  ignoreTime = true
                } else {
                  try {
                    const ids: number[] = JSON.parse(storesValue)
                    ignoreTime = ids.includes(Number(storeId))
                  } catch {
                    ignoreTime = true // fallback safe
                  }
                }
              }
            }
          } catch { /* ignore */ }

          console.log(`[Checklist] Bypass de horario: ${ignoreTime ? 'ATIVO' : 'INATIVO'} (loja: ${storeId})`)
          if (!ignoreTime) {
            const startTime = rawTemplate.allowed_start_time as string
            const endTime = rawTemplate.allowed_end_time as string
            if (!isWithinTimeRange(startTime, endTime)) {
              console.log(`[Checklist] BLOQUEADO por horario — ${startTime} a ${endTime}`)
              setTimeBlocked(true)
              setTimeBlockedMessage(`Este checklist so pode ser respondido entre ${startTime.substring(0, 5)} e ${endTime.substring(0, 5)}`)
            }
          }
        }

        // Check justification deadline
        if (rawTemplate.justification_deadline_hours != null) {
          setJustificationExpired(false) // will be checked when justification is attempted
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ct = cachedTemplate as any
          if (ct.allowed_start_time && ct.allowed_end_time) {
            console.log(`[Checklist/Offline] Verificando horario — start: ${ct.allowed_start_time}, end: ${ct.allowed_end_time}`)
            // Tentar verificar bypass mesmo offline (fetch pode funcionar se houver conexao parcial)
            let ignoreTime = false
            try {
              const token = (await supabase.auth.getSession()).data.session?.access_token || ''
              const bypassRes = await fetch('/api/settings?keys=ignore_time_restrictions,ignore_time_restrictions_stores', {
                headers: { 'x-supabase-auth': token },
              })
              if (bypassRes.ok) {
                const settings: { key: string; value: string }[] = await bypassRes.json()
                const toggleValue = settings.find(s => s.key === 'ignore_time_restrictions')?.value
                const storesValue = settings.find(s => s.key === 'ignore_time_restrictions_stores')?.value
                if (toggleValue === 'true') {
                  if (!storesValue || storesValue === 'all') {
                    ignoreTime = true
                  } else {
                    try {
                      const ids: number[] = JSON.parse(storesValue)
                      ignoreTime = ids.includes(Number(storeId))
                    } catch { ignoreTime = true }
                  }
                }
              }
            } catch { /* offline — bypass nao disponivel */ }

            console.log(`[Checklist/Offline] Bypass de horario: ${ignoreTime ? 'ATIVO' : 'INATIVO'} (loja: ${storeId})`)
            if (!ignoreTime) {
              const startTime = ct.allowed_start_time as string
              const endTime = ct.allowed_end_time as string
              if (!isWithinTimeRange(startTime, endTime)) {
                console.log(`[Checklist/Offline] BLOQUEADO por horario — ${startTime} a ${endTime}`)
                setTimeBlocked(true)
                setTimeBlockedMessage(`Este checklist so pode ser respondido entre ${startTime.substring(0, 5)} e ${endTime.substring(0, 5)}`)
              }
            }
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
      if (initializingRef.current) return
      initializingRef.current = true

      if (timeBlocked) {
        initializingRef.current = false
        return
      }

      try {
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
        } else {
          // Offline: resumeId e ID numerico do DB, nao UUID offline
          // Buscar pelo template+store+user no IndexedDB
          const pendingOffline = await getPendingChecklists()
          const existingOffline = pendingOffline.find(c =>
            c.templateId === Number(templateId) &&
            c.storeId === Number(storeId) &&
            c.userId === userId &&
            c.sections && c.sections.length > 0
          )

          if (existingOffline) {
            setOfflineChecklistId(existingOffline.id)
            setSectionProgress(existingOffline.sections!.map(s => ({
              section_id: s.sectionId,
              status: s.status,
              completed_at: s.completedAt,
            })))
            const restoredResponses = restoreOfflineResponses(existingOffline)
            if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
          }
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
          // Restaurar respostas de todas as secoes
          const restoredResponses = restoreOfflineResponses(existingOffline)
          if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
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

          setOfflineChecklistId(offlineId)
          // Only track progress for sections that have fields (sub-etapas, not parent etapas)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const trackableSections = sortedSections.filter((s: any) => {
            // Parent sections (no parent_id) that have children should NOT be tracked
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hasChildren = sortedSections.some((child: any) => child.parent_id === s.id)
            return !hasChildren // only track leaf sections
          })
          setSectionProgress(trackableSections.map(s => ({
            section_id: s.id,
            status: 'pendente' as const,
            completed_at: null,
          })))
        }
        return
      }

      // === ONLINE MODE ===

      // Migrar draft offline sectioned se existir
      const pendingOfflineSec = await getPendingChecklists()
      const offlineDraftSec = pendingOfflineSec.find(c =>
        c.templateId === Number(templateId) &&
        c.storeId === Number(storeId) &&
        c.userId === userId &&
        c.sections && c.sections.length > 0 &&
        c.syncStatus === 'draft'
      )

      if (offlineDraftSec) {
        const restoredResponses = restoreOfflineResponses(offlineDraftSec)
        if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
        await deleteOfflineChecklist(offlineDraftSec.id)
        console.log('[Checklist] Draft offline sectioned migrado para online:', offlineDraftSec.id)
      }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // Check if already completed/incompleto today - redirect to view
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: completedToday } = await (supabase as any)
        .from('checklists')
        .select('id')
        .eq('template_id', Number(templateId))
        .eq('store_id', Number(storeId))
        .eq('created_by', userId)
        .in('status', ['concluido', 'incompleto', 'validado'])
        .gte('created_at', todayStart.toISOString())
        .limit(1)

      if (completedToday && completedToday.length > 0) {
        router.push(`/checklist/${completedToday[0].id}`)
        return
      }

      // Check for existing em_andamento checklist for this template+store+user today
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
          // Handle unique constraint violation (duplicate em_andamento for today)
          if (createErr.code === '23505') {
            console.warn('[Checklist] Duplicate detected, loading existing checklist')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingRetry } = await (supabase as any)
              .from('checklists')
              .select('id')
              .eq('template_id', Number(templateId))
              .eq('store_id', Number(storeId))
              .eq('created_by', userId)
              .eq('status', 'em_andamento')
              .gte('created_at', todayStart.toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
            if (existingRetry && existingRetry.length > 0) {
              await loadExistingChecklist(existingRetry[0].id)
              return
            }
          }
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
      } finally {
        initializingRef.current = false
      }
    }

    initSectionedChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSections, template, loading, store, timeBlocked])

  // Restaurar respostas de um checklist offline (sectioned ou non-sectioned)
  const restoreOfflineResponses = (checklist: PendingChecklist): Record<number, unknown> => {
    const restoredResponses: Record<number, unknown> = {}

    // Coletar respostas de sections + array principal
    const allResponses: Array<{ fieldId: number; valueText: string | null; valueNumber: number | null; valueJson: unknown }> = []
    if (checklist.sections && checklist.sections.length > 0) {
      for (const section of checklist.sections) {
        allResponses.push(...section.responses)
      }
    }
    allResponses.push(...checklist.responses)

    for (const r of allResponses) {
      const field = template?.fields.find(f => f.id === r.fieldId)
      if (!field) continue
      switch (field.field_type) {
        case 'number':
          if (r.valueJson && typeof r.valueJson === 'object' && 'subtype' in (r.valueJson as Record<string, unknown>)) {
            restoredResponses[r.fieldId] = { subtype: (r.valueJson as Record<string, unknown>).subtype, number: r.valueNumber }
          } else {
            restoredResponses[r.fieldId] = r.valueNumber
          }
          break
        case 'calculated':
          restoredResponses[r.fieldId] = r.valueNumber
          break
        case 'photo': {
          const json = r.valueJson as { photos?: string[] } | null
          restoredResponses[r.fieldId] = json?.photos || []
          break
        }
        case 'yes_no': {
          const yJson = r.valueJson as { photos?: string[]; conditionalText?: string; conditionalPhotos?: string[] } | null
          if (yJson && (yJson.photos?.length || yJson.conditionalText || yJson.conditionalPhotos?.length)) {
            const val: Record<string, unknown> = { answer: r.valueText || '' }
            if (yJson.photos && yJson.photos.length > 0) val.photos = yJson.photos
            if (yJson.conditionalText) val.conditionalText = yJson.conditionalText
            if (yJson.conditionalPhotos && yJson.conditionalPhotos.length > 0) val.conditionalPhotos = yJson.conditionalPhotos
            restoredResponses[r.fieldId] = val
          } else {
            restoredResponses[r.fieldId] = r.valueText
          }
          break
        }
        case 'checkbox_multiple':
        case 'signature':
        case 'gps':
          restoredResponses[r.fieldId] = r.valueJson
          break
        default:
          restoredResponses[r.fieldId] = r.valueText
      }
    }

    return restoredResponses
  }

  const loadExistingChecklist = async (clId: number) => {
    // Verificar se checklist ja foi finalizado - redirecionar para view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clData } = await (supabase as any)
      .from('checklists')
      .select('status')
      .eq('id', clId)
      .single()

    if (clData?.status === 'concluido' || clData?.status === 'validado' || clData?.status === 'incompleto') {
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
            const yJson = r.value_json as { photos?: string[]; conditionalText?: string; conditionalPhotos?: string[] } | null
            if (yJson && (yJson.photos?.length || yJson.conditionalText || yJson.conditionalPhotos?.length)) {
              const val: Record<string, unknown> = { answer: r.value_text || '' }
              if (yJson.photos && yJson.photos.length > 0) val.photos = yJson.photos
              if (yJson.conditionalText) val.conditionalText = yJson.conditionalText
              if (yJson.conditionalPhotos && yJson.conditionalPhotos.length > 0) val.conditionalPhotos = yJson.conditionalPhotos
              restoredResponses[r.field_id] = val
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
      if (initializingRef.current) return
      initializingRef.current = true

      if (timeBlocked) {
        initializingRef.current = false
        return
      }

      try {
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
          c.syncStatus === 'draft'
        )

        if (existingOffline) {
          setOfflineChecklistId(existingOffline.id)
          // Restaurar respostas usando funcao utilitaria
          const restoredResponses = restoreOfflineResponses(existingOffline)
          if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
        } else {
          const offlineId = await saveOfflineChecklist({
            templateId: Number(templateId),
            storeId: Number(storeId),
            sectorId: null,
            userId,
            responses: [],
          })
          setOfflineChecklistId(offlineId)
        }
        return
      }

      // === ONLINE ===

      // Migrar draft offline se existir (usuario preencheu offline e voltou online)
      const pendingOfflineNS = await getPendingChecklists()
      const offlineDraftNS = pendingOfflineNS.find(c =>
        c.templateId === Number(templateId) &&
        c.storeId === Number(storeId) &&
        c.userId === userId &&
        (!c.sections || c.sections.length === 0) &&
        c.syncStatus === 'draft'
      )

      if (offlineDraftNS) {
        const restoredResponses = restoreOfflineResponses(offlineDraftNS)
        if (Object.keys(restoredResponses).length > 0) setResponses(restoredResponses)
        await deleteOfflineChecklist(offlineDraftNS.id)
        console.log('[Checklist] Draft offline migrado para online:', offlineDraftNS.id)
      }

      // If resuming a specific checklist (from dashboard "Continuar" link)
      if (resumeId) {
        await loadExistingChecklist(Number(resumeId))
        return
      }

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // Check if already completed/incompleto today - redirect to view
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: completedToday } = await (supabase as any)
        .from('checklists')
        .select('id')
        .eq('template_id', Number(templateId))
        .eq('store_id', Number(storeId))
        .eq('created_by', userId)
        .in('status', ['concluido', 'incompleto', 'validado'])
        .gte('created_at', todayStart.toISOString())
        .limit(1)

      if (completedToday && completedToday.length > 0) {
        router.push(`/checklist/${completedToday[0].id}`)
        return
      }

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
          // Handle unique constraint violation (duplicate em_andamento for today)
          if (createErr.code === '23505') {
            console.warn('[Checklist] Duplicate detected, loading existing checklist')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existingRetry } = await (supabase as any)
              .from('checklists')
              .select('id')
              .eq('template_id', Number(templateId))
              .eq('store_id', Number(storeId))
              .eq('created_by', userId)
              .eq('status', 'em_andamento')
              .gte('created_at', todayStart.toISOString())
              .order('created_at', { ascending: false })
              .limit(1)
            if (existingRetry && existingRetry.length > 0) {
              await loadExistingChecklist(existingRetry[0].id)
              return
            }
          }
          console.error('[Checklist] Erro ao criar checklist:', createErr)
          return
        }
        setChecklistId(newChecklist.id)
      }
      } finally {
        initializingRef.current = false
      }
    }

    initNonSectionedChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSections, template, loading, store, timeBlocked])

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
        const yesNoObj = value as Record<string, unknown>
        valueText = yesNoObj.answer as string
        const jsonParts: Record<string, unknown> = {}
        // Salvar apenas URLs de fotos (nunca base64 — base64 fica no state ate upload ao Storage)
        if (yesNoObj.photos && (yesNoObj.photos as string[]).length > 0) {
          const urls = (yesNoObj.photos as string[]).filter(p => typeof p === 'string' && p.startsWith('http'))
          if (urls.length > 0) jsonParts.photos = urls
        }
        if (yesNoObj.conditionalText) jsonParts.conditionalText = yesNoObj.conditionalText
        if (yesNoObj.conditionalPhotos && (yesNoObj.conditionalPhotos as string[]).length > 0) {
          const urls = (yesNoObj.conditionalPhotos as string[]).filter(p => typeof p === 'string' && p.startsWith('http'))
          if (urls.length > 0) jsonParts.conditionalPhotos = urls
        }
        // Plano de acao: funcao responsavel, severidade e modelo
        if (yesNoObj.selectedFunctionId) jsonParts.selectedFunctionId = yesNoObj.selectedFunctionId
        if (yesNoObj.selectedSeverity) jsonParts.selectedSeverity = yesNoObj.selectedSeverity
        if (yesNoObj.selectedPresetId) jsonParts.selectedPresetId = yesNoObj.selectedPresetId
        // Legado: selectedAssigneeId (UUID de usuario)
        if (yesNoObj.selectedAssigneeId) jsonParts.selectedAssigneeId = yesNoObj.selectedAssigneeId
        if (Object.keys(jsonParts).length > 0) valueJson = jsonParts
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
      if (navigator.onLine && checklistIdRef.current) {
        // Online: upsert to checklist_responses
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id || null
        } catch { /* offline */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: upsertErr } = await (supabase as any)
          .from('checklist_responses')
          .upsert({
            checklist_id: checklistIdRef.current,
            field_id: row.fieldId,
            value_text: row.valueText,
            value_number: row.valueNumber,
            value_json: row.valueJson,
            answered_by: userId,
          }, { onConflict: 'checklist_id,field_id' })
        if (upsertErr) {
          console.error('[AutoSave] Upsert error:', upsertErr)
          setAutoSaveStatus('error')
          return
        }
      } else if (offlineChecklistIdRef.current) {
        // Offline: update in IndexedDB
        const field = template?.fields.find(f => f.id === fieldId)
        const sectionId = field?.section_id ?? null
        await updateOfflineFieldResponse(offlineChecklistIdRef.current, sectionId, fieldId, {
          valueText: row.valueText,
          valueNumber: row.valueNumber,
          valueJson: row.valueJson,
        })
      } else {
        // IDs ainda nao disponiveis — aguardar inicializacao e tentar de novo
        let retries = 0
        const maxRetries = 5
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500))
          retries++
          if (checklistIdRef.current || offlineChecklistIdRef.current) break
        }

        // Tentar salvar apos espera
        if (navigator.onLine && checklistIdRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: retryErr } = await (supabase as any)
            .from('checklist_responses')
            .upsert({
              checklist_id: checklistIdRef.current,
              field_id: row.fieldId,
              value_text: row.valueText,
              value_number: row.valueNumber,
              value_json: row.valueJson,
            }, { onConflict: 'checklist_id,field_id' })
          if (retryErr) {
            console.error('[AutoSave] Retry upsert error:', retryErr)
            setAutoSaveStatus('error')
            return
          }
        } else if (offlineChecklistIdRef.current) {
          const field = template?.fields.find(f => f.id === fieldId)
          const sectionId = field?.section_id ?? null
          await updateOfflineFieldResponse(offlineChecklistIdRef.current, sectionId, fieldId, {
            valueText: row.valueText,
            valueNumber: row.valueNumber,
            valueJson: row.valueJson,
          })
        } else {
          console.warn('[AutoSave] IDs nao disponiveis ainda, resposta mantida em memoria')
          setAutoSaveStatus('idle')
          return
        }
      }

      setAutoSaveStatus('saved')
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[AutoSave] Error:', err)
      setAutoSaveStatus('error')
    }
  }, 1500)

  // Immediate offline save (IndexedDB is near-instant, no need for 1.5s debounce)
  const saveFieldOfflineImmediate = useCallback(async (fieldId: number, value: unknown) => {
    const row = buildSingleResponseRow(fieldId, value)
    if (!row || !offlineChecklistIdRef.current) return
    setAutoSaveStatus('saving')
    try {
      const field = template?.fields.find(f => f.id === fieldId)
      const sectionId = field?.section_id ?? null
      await updateOfflineFieldResponse(offlineChecklistIdRef.current, sectionId, fieldId, {
        valueText: row.valueText,
        valueNumber: row.valueNumber,
        valueJson: row.valueJson,
      })
      setAutoSaveStatus('saved')
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('[AutoSave] Offline immediate error:', err)
      setAutoSaveStatus('error')
    }
  }, [buildSingleResponseRow, template])

  // Flush auto-save on ANY exit scenario (mobile + desktop)
  useEffect(() => {
    // Desktop: beforeunload (fecha aba, reload)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      autoSaveField.flush()
      e.preventDefault()
    }
    // Mobile: visibilitychange (tela bloqueou, trocou app, fechou browser)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        autoSaveField.flush()
      }
    }
    // iOS Safari: pagehide (mais confiavel que beforeunload)
    const handlePageHide = () => {
      autoSaveField.flush()
    }
    // Android: blur no window (trocou de app sem pagehide)
    const handleWindowBlur = () => {
      autoSaveField.flush()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('blur', handleWindowBlur)
      autoSaveField.flush()
    }
  }, [autoSaveField])

  const updateResponse = (fieldId: number, value: unknown) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }))
    if (errors[fieldId]) {
      setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n })
    }
    // Sempre salvar no IndexedDB como backup (rapido, local)
    if (offlineChecklistIdRef.current) {
      saveFieldOfflineImmediate(fieldId, value)
    }
    // Online: tambem salvar no Supabase
    if (navigator.onLine) {
      autoSaveField(fieldId, value)
      // Para respostas de selecao (yes_no, dropdown, rating, checkbox), flush imediato
      // Texto usa debounce normal (usuario ainda esta digitando)
      const field = template?.fields.find(f => f.id === fieldId)
      if (field && ['yes_no', 'dropdown', 'checkbox_multiple', 'rating', 'signature'].includes(field.field_type)) {
        autoSaveField.flush()
      }
    }
  }

  // Navigate back to dashboard, ensuring pending auto-save completes
  const handleBackToDashboard = useCallback(async () => {
    autoSaveField.flush()
    await new Promise(resolve => setTimeout(resolve, 500))
    router.push(APP_CONFIG.routes.dashboard)
  }, [autoSaveField, router])

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
        // yes_no can be string (legacy) or { answer, photos, conditionalText, conditionalPhotos }
        if (typeof value === 'object' && value !== null && 'answer' in (value as Record<string, unknown>)) {
          const yesNoObj = value as { answer: string; photos?: string[]; conditionalText?: string; conditionalPhotos?: string[] }
          valueText = yesNoObj.answer
          const jsonParts: Record<string, unknown> = {}
          if (yesNoObj.photos && yesNoObj.photos.length > 0 && attemptUpload) {
            const uploadedUrls: string[] = []
            for (let i = 0; i < yesNoObj.photos.length; i++) {
              const url = await uploadPhoto(yesNoObj.photos[i], `checklist_${Date.now()}_yesno_foto_${i + 1}.jpg`, 'anexos')
              uploadedUrls.push(url || yesNoObj.photos[i])
            }
            jsonParts.photos = uploadedUrls
          } else if (yesNoObj.photos && yesNoObj.photos.length > 0) {
            // Sem upload: salvar apenas URLs (nunca base64)
            const urls = yesNoObj.photos.filter((p: string) => p.startsWith('http'))
            if (urls.length > 0) jsonParts.photos = urls
          }
          if (yesNoObj.conditionalText) jsonParts.conditionalText = yesNoObj.conditionalText
          if (yesNoObj.conditionalPhotos && yesNoObj.conditionalPhotos.length > 0 && attemptUpload) {
            const uploadedUrls: string[] = []
            for (let i = 0; i < yesNoObj.conditionalPhotos.length; i++) {
              const url = await uploadPhoto(yesNoObj.conditionalPhotos[i], `checklist_${Date.now()}_yesno_cond_foto_${i + 1}.jpg`, 'anexos')
              uploadedUrls.push(url || yesNoObj.conditionalPhotos[i])
            }
            // Filtrar base64 residuais (upload falhou)
            jsonParts.conditionalPhotos = uploadedUrls.filter((u: string) => u.startsWith('http'))
          } else if (yesNoObj.conditionalPhotos && yesNoObj.conditionalPhotos.length > 0) {
            const urls = yesNoObj.conditionalPhotos.filter((p: string) => p.startsWith('http'))
            if (urls.length > 0) jsonParts.conditionalPhotos = urls
          }
          // Preservar dados do plano de acao para processarNaoConformidades
          const fullObj = value as Record<string, unknown>
          if (fullObj.selectedFunctionId) jsonParts.selectedFunctionId = fullObj.selectedFunctionId
          if (fullObj.selectedAssigneeId) jsonParts.selectedAssigneeId = fullObj.selectedAssigneeId
          if (fullObj.selectedSeverity) jsonParts.selectedSeverity = fullObj.selectedSeverity
          if (fullObj.selectedPresetId) jsonParts.selectedPresetId = fullObj.selectedPresetId
          if (Object.keys(jsonParts).length > 0) valueJson = jsonParts
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

  // Get all empty required fields across all sections (for finalization check)
  const getEmptyRequiredFields = (): FieldWithSection[] => {
    if (!template) return []
    return template.fields.filter(field => {
      if (field.field_type === 'gps') return false
      const value = responses[field.id]

      // 1. Campo marcado is_required sem valor algum
      if (field.is_required) {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          return true
        }
        // Texto obrigatorio: minimo 3 caracteres reais
        if (field.field_type === 'text' && typeof value === 'string' && value.trim().length < 3) {
          return true
        }
      }

      // 2. Validacoes especificas de yes_no (sub-campos obrigatorios)
      // Valor pode ser string ("sim"/"nao") ou objeto ({answer:"sim", photos:[...]})
      if (field.field_type === 'yes_no' && value !== undefined && value !== null && value !== '') {
        let ans: string | undefined
        let obj: Record<string, unknown> = {}
        if (typeof value === 'string') {
          ans = value
        } else if (typeof value === 'object') {
          obj = value as Record<string, unknown>
          ans = obj.answer as string | undefined
        }

        // Se is_required e nao respondeu
        if (field.is_required && (!ans || ans === '')) return true

        // Se respondeu, verificar sub-campos obrigatorios
        if (ans) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opts = field.options as any

          // Foto principal obrigatoria (photoRequired)
          if (opts?.photoRequired === true) {
            const photos = obj.photos as string[] | undefined
            if (!photos || photos.length === 0) return true
          }

          // Campos condicionais obrigatorios (independente de is_required do campo pai)
          const condConfig = (ans === 'nao' ? opts?.onNo : ans === 'sim' ? opts?.onYes : ans === 'na' ? opts?.onNa : undefined) as
            { showTextField?: boolean; textFieldRequired?: boolean; showPhotoField?: boolean; photoFieldRequired?: boolean } | undefined
          if (condConfig) {
            if (condConfig.showTextField && condConfig.textFieldRequired) {
              const text = obj.conditionalText as string | undefined
              if (!text || text.trim().length < 3) return true
            }
            if (condConfig.showPhotoField && condConfig.photoFieldRequired) {
              const photos = obj.conditionalPhotos as string[] | undefined
              if (!photos || photos.length === 0) return true
            }
          }
        }
      }

      return false
    })
  }

  // Pre-finalize: validates all fields, shows justification modal if incomplete
  const handlePreFinalize = async () => {
    autoSaveField.flush()

    const emptyFields = getEmptyRequiredFields()
    if (emptyFields.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawTpl = template as any

      // Se template tem skip_justifications, auto-preencher e finalizar direto
      if (rawTpl?.skip_justifications === true) {
        setSubmitting(true)
        try {
          let userId: string | null = null
          try {
            const { data: { user } } = await supabase.auth.getUser()
            userId = user?.id || null
          } catch { /* offline */ }
          if (!userId || !checklistId) { setSubmitting(false); return }

          // Inserir justificativas automaticas no banco
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('checklist_justifications').upsert(
            emptyFields.map(f => ({
              checklist_id: checklistId,
              field_id: f.id,
              justification_text: 'Campo finalizado vazio',
              justified_by: userId,
            })),
            { onConflict: 'checklist_id,field_id' }
          )
          // Marcar como incompleto e finalizar
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('checklists')
            .update({ status: 'incompleto', completed_at: new Date().toISOString() })
            .eq('id', checklistId)

          // Processar nao conformidades
          if (template) {
            const allFieldIds = template.fields.map(f => f.id)
            const allResponseData = await buildResponseRows(allFieldIds, false)
            const allResponseMapped = allResponseData.map(r => ({
              field_id: r.fieldId, value_text: r.valueText, value_number: r.valueNumber, value_json: r.valueJson,
            }))
            await processarNaoConformidades(
              supabase, checklistId, Number(templateId), Number(storeId), null, userId,
              allResponseMapped, template.fields.map(f => ({ id: f.id, name: f.name, field_type: f.field_type, options: f.options }))
            )
          }
          window.location.href = `${APP_CONFIG.routes.dashboard}?finished=true`
        } catch (err) {
          console.error('[Checklist] Erro ao finalizar sem justificativas:', err)
          setSubmitting(false)
        }
        return
      }

      // Check justification deadline before showing modal
      if (rawTpl?.justification_deadline_hours != null && checklistId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: checklistData } = await (supabase as any)
            .from('checklists')
            .select('created_at')
            .eq('id', checklistId)
            .single()
          if (checklistData) {
            const createdAt = new Date(checklistData.created_at)
            const deadlineMs = rawTpl.justification_deadline_hours * 60 * 60 * 1000
            const deadlineDate = new Date(createdAt.getTime() + deadlineMs)
            if (new Date() > deadlineDate) {
              setJustificationExpired(true)
              setJustificationExpiredMessage(`Prazo para justificativa expirou (${rawTpl.justification_deadline_hours}h)`)
            }
          }
        } catch { /* ignore */ }
      }

      // Has empty required fields: show incomplete modal for justification
      setEmptyRequiredFields(emptyFields)
      setShowIncompleteModal(true)
      return
    }

    // All required fields filled: finalize normally
    await handleFinalizeChecklist()
  }

  // === SECTION BACK: auto-mark section as complete if all required fields are filled ===
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSectionBack = useCallback(async () => {
    // Flush pending auto-save
    autoSaveField.flush()

    if (activeSection === null) { setActiveSection(null); return }

    const sectionFields = getFieldsForSection(activeSection)

    // Bulk save ALL responses for this section (debounce may have skipped some)
    try {
      if (navigator.onLine && checklistIdRef.current) {
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id || null
        } catch { /* offline */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = sectionFields
          .map(f => {
            const row = buildSingleResponseRow(f.id, responsesRef.current[f.id])
            if (!row) return null
            return {
              checklist_id: checklistIdRef.current,
              field_id: row.fieldId,
              value_text: row.valueText,
              value_number: row.valueNumber,
              value_json: row.valueJson,
              answered_by: userId,
            }
          })
          .filter(Boolean)

        if (rows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('checklist_responses')
            .upsert(rows, { onConflict: 'checklist_id,field_id' })
        }
      } else if (offlineChecklistIdRef.current) {
        // Propagate DB checklist ID to offline record (started online, now offline)
        if (checklistIdRef.current) {
          const cl = await getOfflineChecklist(offlineChecklistIdRef.current)
          if (cl && !cl.dbChecklistId) {
            cl.dbChecklistId = checklistIdRef.current
            await putOfflineChecklist(cl)
          }
        }
        for (const f of sectionFields) {
          const row = buildSingleResponseRow(f.id, responsesRef.current[f.id])
          if (!row) continue
          await updateOfflineFieldResponse(offlineChecklistIdRef.current, activeSection, f.id, {
            valueText: row.valueText,
            valueNumber: row.valueNumber,
            valueJson: row.valueJson,
          })
        }
      }
    } catch (err) {
      console.error('[Checklist] Erro no bulk save da secao:', err)
    }

    // Check if all required fields and required sub-fields are filled
    const currentResponses = responsesRef.current
    const allRequiredFilled = sectionFields
      .filter(f => f.field_type !== 'gps')
      .every(field => {
        const v = currentResponses[field.id]

        // Campo is_required sem valor
        if (field.is_required) {
          if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return false
          // Texto obrigatorio: minimo 3 caracteres reais
          if (field.field_type === 'text' && typeof v === 'string' && v.trim().length < 3) return false
        }

        // Validacoes yes_no (sub-campos obrigatorios)
        // Valor pode ser string ("sim"/"nao") ou objeto ({answer:"sim", photos:[...]})
        if (field.field_type === 'yes_no' && v !== undefined && v !== null && v !== '') {
          let ans: string | undefined
          let obj: Record<string, unknown> = {}
          if (typeof v === 'string') {
            ans = v
          } else if (typeof v === 'object') {
            obj = v as Record<string, unknown>
            ans = obj.answer as string | undefined
          }
          if (field.is_required && (!ans || ans === '')) return false

          if (ans) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const opts = field.options as any

            // Foto principal obrigatoria
            if (opts?.photoRequired === true) {
              const photos = obj.photos as string[] | undefined
              if (!photos || photos.length === 0) return false
            }

            // Campos condicionais obrigatorios
            const condConfig = (ans === 'nao' ? opts?.onNo : ans === 'sim' ? opts?.onYes : undefined) as
              { showTextField?: boolean; textFieldRequired?: boolean; showPhotoField?: boolean; photoFieldRequired?: boolean } | undefined
            if (condConfig) {
              if (condConfig.showTextField && condConfig.textFieldRequired) {
                const text = obj.conditionalText as string | undefined
                if (!text || text.trim().length < 3) return false
              }
              if (condConfig.showPhotoField && condConfig.photoFieldRequired) {
                const photos = obj.conditionalPhotos as string[] | undefined
                if (!photos || photos.length === 0) return false
              }
            }
          }
        }

        return true
      })

    // Has at least one response in this section
    const hasAnyResponse = sectionFields.some(f => {
      const v = currentResponses[f.id]
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

            // Se TODAS as secoes estao concluidas, liberar para sync
            const allDone = cl.sections.every(s => s.status === 'concluido')
            if (allDone) {
              await updateChecklistStatus(offlineChecklistId, 'pending')
            }
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

    // In hierarchical mode, go back to parent section list instead of main list
    if (hasSubSections && activeParentSection !== null) {
      setActiveSection(null) // back to sub-etapa list for this parent
    } else {
      setActiveSection(null)
      setActiveParentSection(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveField, activeSection, getFieldsForSection, buildSingleResponseRow, supabase, checklistId, offlineChecklistId, sectionProgress, hasSubSections, activeParentSection])

  // === SWITCH SECTION: flush + bulk save ANTES de trocar de secao ===
  // Previne perda de respostas quando o usuario clica direto em outra secao
  const switchSection = async (newSectionId: number | null) => {
    // 1. Flush pending debounced auto-save
    autoSaveField.flush()
    await new Promise(resolve => setTimeout(resolve, 200))

    // 2. Bulk save current section responses
    if (activeSection !== null && activeSection !== -1 && navigator.onLine && checklistIdRef.current) {
      try {
        const sectionFields = getFieldsForSection(activeSection)
        let userId: string | null = null
        try {
          const { data: { user } } = await supabase.auth.getUser()
          userId = user?.id || null
        } catch { /* offline */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[] = sectionFields
          .map(f => {
            const row = buildSingleResponseRow(f.id, responsesRef.current[f.id])
            if (!row) return null
            return {
              checklist_id: checklistIdRef.current,
              field_id: row.fieldId,
              value_text: row.valueText,
              value_number: row.valueNumber,
              value_json: row.valueJson,
              answered_by: userId,
            }
          })
          .filter(Boolean)

        if (rows.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('checklist_responses')
            .upsert(rows, { onConflict: 'checklist_id,field_id' })
        }
      } catch (err) {
        console.error('[SwitchSection] Erro ao salvar secao:', err)
      }
    }

    // 3. Switch to new section
    setActiveSection(newSectionId)
  }

  // Handle Android back button and navigation
  // Ref estavel para o handler (evita re-registrar listener a cada campo preenchido)
  const popStateHandlerRef = useRef<() => Promise<void>>()

  // Atualiza a ref quando as dependencias mudam (sem re-registrar o listener)
  useEffect(() => {
    popStateHandlerRef.current = async () => {
      // Sempre salvar pendencias antes de qualquer navegacao
      autoSaveField.flush()
      if (hasSections && activeSection !== null) {
        window.history.pushState(null, '', window.location.href)
        await handleSectionBack()
      } else if (hasSubSections && activeParentSection !== null) {
        window.history.pushState(null, '', window.location.href)
        setActiveParentSection(null)
      } else {
        await new Promise(resolve => setTimeout(resolve, 300))
        router.push(APP_CONFIG.routes.dashboard)
      }
    }
  }, [hasSections, activeSection, handleSectionBack, autoSaveField, router, hasSubSections, activeParentSection])

  // Registra listener UMA VEZ no mount + pushState UMA VEZ
  useEffect(() => {
    const handler = () => { popStateHandlerRef.current?.() }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // === UPLOAD PENDING PHOTOS (base64 → cloud) ===
  const uploadPendingPhotos = async (clId: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: respData } = await (supabase as any)
      .from('checklist_responses')
      .select('id, field_id, value_json')
      .eq('checklist_id', clId)

    if (!respData) return

    for (const r of respData) {
      const json = r.value_json as Record<string, unknown> | null
      if (!json) continue

      const photos = json.photos as string[] | undefined
      const condPhotos = json.conditionalPhotos as string[] | undefined
      const hasBase64Photos = photos?.some((p: string) => p.startsWith('data:')) || false
      const hasBase64CondPhotos = condPhotos?.some((p: string) => p.startsWith('data:')) || false
      if (!hasBase64Photos && !hasBase64CondPhotos) continue

      const updatedJson: Record<string, unknown> = { ...json }

      const sanitizeName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40)
      const tName = template?.name ? sanitizeName(template.name) : `t${templateId}`
      const sName = store?.name ? sanitizeName(store.name) : `s${storeId}`
      const folder = templateId ? `uploads/${tName}/${sName}_cl${clId}` : undefined

      if (photos && hasBase64Photos) {
        const uploadedUrls: string[] = []
        for (let i = 0; i < photos.length; i++) {
          if (photos[i].startsWith('data:')) {
            const url = await uploadPhoto(photos[i], `field_${r.field_id}_foto_${i + 1}.jpg`, folder)
            uploadedUrls.push(url || photos[i])
          } else {
            uploadedUrls.push(photos[i])
          }
        }
        updatedJson.photos = uploadedUrls
        updatedJson.uploadedToDrive = true
      }

      if (condPhotos && hasBase64CondPhotos) {
        const uploadedUrls: string[] = []
        for (let i = 0; i < condPhotos.length; i++) {
          if (condPhotos[i].startsWith('data:')) {
            const url = await uploadPhoto(condPhotos[i], `field_${r.field_id}_cond_foto_${i + 1}.jpg`, folder)
            uploadedUrls.push(url || condPhotos[i])
          } else {
            uploadedUrls.push(condPhotos[i])
          }
        }
        updatedJson.conditionalPhotos = uploadedUrls
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('checklist_responses')
        .update({ value_json: updatedJson })
        .eq('id', r.id)
    }
  }

  // === FINALIZE CHECKLIST (both sectioned and non-sectioned) ===
  const handleFinalizeChecklist = async () => {
    // Finalizar exige internet — show modal if offline
    if (!navigator.onLine) {
      // Mark offline checklist as ready for sync when connectivity returns
      if (offlineChecklistIdRef.current) {
        try { await updateChecklistStatus(offlineChecklistIdRef.current, 'pending') }
        catch (e) { console.error('[Checklist] Error marking offline as pending:', e) }
      }
      setShowOfflineModal(true)
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
        // Finalize checklist status
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('checklists')
          .update({ status: 'concluido', completed_at: new Date().toISOString() })
          .eq('id', checklistId)

        // Process cross validation + non-conformity
        if (template) {
          const allFieldIds = template.fields.map(f => f.id)
          // attemptUpload: true — uploads base64 photos from React state to Storage
          const allResponseData = await buildResponseRows(allFieldIds, true)

          // Atualizar DB com URLs uploadadas (auto-save filtrou base64, agora temos URLs)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any
          for (const row of allResponseData) {
            await sb.from('checklist_responses')
              .update({
                value_text: row.valueText,
                value_number: row.valueNumber,
                value_json: row.valueJson,
              })
              .eq('checklist_id', checklistId)
              .eq('field_id', row.fieldId)
          }

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

  // === FINALIZE WITH JUSTIFICATIONS (incomplete checklist) ===
  const handleFinalizeWithJustifications = async () => {
    // Validate all justifications are filled
    const missing = emptyRequiredFields.filter(f => !justifications[f.id]?.trim() || justifications[f.id].trim().length < 3)
    if (missing.length > 0) return

    if (!navigator.onLine || !checklistId) {
      setShowOfflineModal(true)
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
      // Insert justifications
      const justificationRows = emptyRequiredFields.map(field => ({
        checklist_id: checklistId,
        field_id: field.id,
        justification_text: justifications[field.id].trim(),
        justified_by: userId,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('checklist_justifications').insert(justificationRows)

      // Mark checklist as incompleto
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('checklists')
        .update({ status: 'incompleto', completed_at: new Date().toISOString() })
        .eq('id', checklistId)

      // Process cross-validation + non-conformities
      if (template) {
        const allFieldIds = template.fields.map(f => f.id)
        // attemptUpload: true — uploads base64 photos from React state to Storage
        const allResponseData = await buildResponseRows(allFieldIds, true)

        // Atualizar DB com URLs uploadadas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any
        for (const row of allResponseData) {
          await sb.from('checklist_responses')
            .update({
              value_text: row.valueText,
              value_number: row.valueNumber,
              value_json: row.valueJson,
            })
            .eq('checklist_id', checklistId)
            .eq('field_id', row.fieldId)
        }

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
        action: 'checklist_incompleto',
        details: {
          template_name: template?.name,
          justified_fields: emptyRequiredFields.map(f => f.name),
          justification_count: emptyRequiredFields.length,
        },
      })

      setSuccess(true)
      setTimeout(() => router.push(APP_CONFIG.routes.dashboard), 2000)
    } catch (err) {
      console.error('[Checklist] Erro ao finalizar com justificativas:', err)
      setErrors({ 0: err instanceof Error ? err.message : 'Erro ao finalizar checklist' })
      setSubmitting(false)
    }
  }

  // === FINALIZE (non-sectioned templates) ===
  // Uses handlePreFinalize which validates + shows justification modal if needed
  const handleNonSectionedFinalize = async () => {
    await handlePreFinalize()
  }

  // === TECH USER: Reset all add-field modal states ===
  const resetAddFieldModal = () => {
    setShowAddFieldModal(false)
    setNewFieldName('')
    setNewFieldType('yes_no')
    setNewFieldRequired(true)
    setNewFieldPlaceholder('')
    setNewFieldHelpText('')
    setNewFieldOptions([])
    setNewFieldOptionInput('')
    setNewFieldAllowPhoto(false)
    setNewFieldOnNo({
      showTextField: false,
      textFieldRequired: false,
      showPhotoField: false,
      photoFieldRequired: false,
      allowUserActionPlan: false,
    })
    setAddFieldSectionId(null)
  }

  // === TECH USER: Adicionar campo ao template ===
  const handleAddField = async () => {
    if (!newFieldName.trim() || !template || addingField) return
    setAddingField(true)

    try {
      // Calcular sort_order: maior sort_order da secao + 1
      const sectionFields = addFieldSectionId
        ? template.fields.filter(f => f.section_id === addFieldSectionId)
        : template.fields.filter(f => !f.section_id)
      const maxSort = sectionFields.reduce((max, f) => Math.max(max, f.sort_order || 0), 0)

      // Build options JSONB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fieldOptions: Record<string, unknown> = {}
      if (newFieldType === 'yes_no') {
        if (newFieldAllowPhoto) fieldOptions.allowPhoto = true
        if (newFieldOnNo.showTextField || newFieldOnNo.showPhotoField || newFieldOnNo.allowUserActionPlan) {
          fieldOptions.onNo = { ...newFieldOnNo }
        }
      }
      if ((newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') && newFieldOptions.length > 0) {
        fieldOptions.items = newFieldOptions
      }

      const optionsValue = Object.keys(fieldOptions).length > 0
        ? fieldOptions
        : (newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') ? [] : null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newField, error } = await (supabase as any)
        .from('template_fields')
        .insert({
          template_id: Number(templateId),
          section_id: addFieldSectionId,
          name: newFieldName.trim(),
          field_type: newFieldType,
          is_required: newFieldRequired,
          sort_order: maxSort + 1,
          placeholder: newFieldPlaceholder.trim() || null,
          help_text: newFieldHelpText.trim() || null,
          options: optionsValue,
        })
        .select()
        .single()

      if (error) throw error

      // Adicionar o campo ao template local (sem recarregar pagina)
      if (newField && template) {
        setTemplate({
          ...template,
          fields: [...template.fields, { ...newField, section_id: addFieldSectionId }],
        })
      }

      // Limpar modal
      resetAddFieldModal()
    } catch (err) {
      console.error('[TechUser] Erro ao adicionar campo:', err)
      alert('Erro ao adicionar campo. Tente novamente.')
    } finally {
      setAddingField(false)
    }
  }

  // ========== RENDER ==========

  if (loading) return <LoadingPage />

  // Offline finalization modal
  if (showOfflineModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <FiCloudOff className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-lg font-bold text-main mb-2">Sem conexao</h2>
          <p className="text-sm text-secondary mb-6">
            Suas respostas estao salvas e serao sincronizadas automaticamente quando voce estiver online.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowOfflineModal(false)}
              className="btn-primary w-full py-3"
            >
              Continuar preenchendo
            </button>
            <button
              type="button"
              onClick={() => router.push(APP_CONFIG.routes.dashboard)}
              className="btn-ghost w-full py-3"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (timeBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center max-w-md mx-auto px-4">
          <FiAlertCircle className="w-16 h-16 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold text-main mb-2">Fora do horario permitido</h2>
          <p className="text-secondary mb-6">{timeBlockedMessage}</p>
          <Link href={APP_CONFIG.routes.dashboard} className="btn-primary inline-block px-6 py-3">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

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

  // Justification screen (for incomplete checklist finalization)
  if (showJustificationScreen) {
    const allJustified = emptyRequiredFields.every(f => justifications[f.id]?.trim() && justifications[f.id].trim().length >= 3)
    return (
      <div className="min-h-screen bg-page">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-4 sm:p-6 mb-6 border-l-4 border-warning">
            <p className="text-sm text-secondary">
              Preencha uma justificativa para cada campo obrigatorio nao respondido.
              Todos os campos abaixo precisam de uma explicacao.
            </p>
          </div>
          <div className="space-y-4">
            {emptyRequiredFields.map((field, idx) => {
              // Find which section this field belongs to
              const section = hasSections && field.section_id
                ? sortedSections.find(s => s.id === field.section_id)
                : null
              return (
                <div key={field.id} className="card p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted">
                    <span className="w-6 h-6 rounded-full bg-warning/20 flex items-center justify-center text-warning text-xs font-bold">{idx + 1}</span>
                    <span>de {emptyRequiredFields.length}</span>
                    {section && (
                      <span className="ml-auto text-xs text-muted">{section.name}</span>
                    )}
                  </div>
                  <label className="font-medium text-main block mb-2">{field.name}</label>
                  {field.help_text && <p className="text-sm text-muted mb-2">{field.help_text}</p>}
                  <p className="text-xs text-warning mb-3">Campo obrigatorio nao preenchido</p>
                  <textarea
                    value={justifications[field.id] || ''}
                    onChange={(e) => setJustifications(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder="Explique o motivo pelo qual este campo nao foi preenchido..."
                    className="input w-full px-4 py-3 rounded-xl min-h-[100px]"
                    rows={3}
                  />
                  {!justifications[field.id]?.trim() && (
                    <p className="text-xs text-error mt-1">Justificativa obrigatoria</p>
                  )}
                </div>
              )
            })}
          </div>
          <div className="sticky bottom-4 mt-6 space-y-3">
            <button
              type="button"
              onClick={handleFinalizeWithJustifications}
              disabled={submitting || !allJustified}
              className="btn-primary w-full py-4 text-base font-semibold rounded-2xl shadow-theme-lg disabled:opacity-50"
            >
              {submitting ? (
                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-2" /> Finalizando...</>
              ) : (
                'Finalizar com Justificativas'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowJustificationScreen(false)}
              className="btn-ghost w-full py-3"
            >
              Voltar e continuar preenchendo
            </button>
          </div>
        </main>
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

  // ============ HIERARCHICAL TEMPLATE: SUB-ETAPAS LIST VIEW ============
  if (hasSections && hasSubSections && activeParentSection !== null && activeSection === null) {
    const parentSection = parentSections.find(s => s.id === activeParentSection)
    const subSections = getSubSections(activeParentSection)
    const allParentFields = getFieldsForParentSection(activeParentSection)
    const completedSubCount = subSections.filter(sub => {
      const progress = sectionProgress.find(sp => sp.section_id === sub.id)
      return progress?.status === 'concluido'
    }).length
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const progressPct = subSections.length > 0 ? Math.round((completedSubCount / subSections.length) * 100) : 0

    return (
      <div className="min-h-screen bg-page">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-1">
            <FiLayers className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-main">{parentSection?.name}</h2>
          </div>
          <p className="text-xs text-muted mb-6">{allParentFields.length} campo{allParentFields.length !== 1 ? 's' : ''} no total</p>

          <div className="space-y-3">
            {subSections.map((sub, idx) => {
              const progress = sectionProgress.find(sp => sp.section_id === sub.id)
              const isDone = progress?.status === 'concluido'
              const subFields = getFieldsForSection(sub.id)

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => switchSection(sub.id)}
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
                        {sub.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-muted">
                        {subFields.length} campo{subFields.length !== 1 ? 's' : ''}
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

          <div className="mt-4">
            <button onClick={() => setActiveParentSection(null)} className="btn-ghost w-full py-3 text-center block">
              Voltar às Etapas
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ============ SECTIONED TEMPLATE: SECTION LIST VIEW ============
  if (hasSections && activeSection === null) {
    // Determine which sections to show at the top level
    const topLevelSections = hasSubSections ? parentSections : sortedSections
    const completedCount = hasSubSections
      ? flatSections.filter(s => sectionProgress.find(sp => sp.section_id === s.id)?.status === 'concluido').length
      : sectionProgress.filter(sp => sp.status === 'concluido').length
    const hasGeneralFields = generalFields.length > 0
    const totalCount = hasSubSections
      ? flatSections.length + (hasGeneralFields ? 1 : 0)
      : topLevelSections.length + (hasGeneralFields ? 1 : 0)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    return (
      <div className="min-h-screen bg-page">
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 mb-6">
            <FiLayers className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-main">Etapas do Checklist</h2>
          </div>

          <div className="space-y-3">
            {topLevelSections.map((section, idx) => {
              if (hasSubSections) {
                // Hierarchical mode: show parent sections with aggregated progress
                const subSections = getSubSections(section.id)
                const allFields = getFieldsForParentSection(section.id)
                const completedSubs = subSections.filter(sub => {
                  const p = sectionProgress.find(sp => sp.section_id === sub.id)
                  return p?.status === 'concluido'
                }).length
                const allDone = completedSubs === subSections.length && subSections.length > 0

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveParentSection(section.id)}
                    className={`w-full text-left card p-3 sm:p-5 transition-all hover:shadow-theme-md cursor-pointer ${
                      allDone
                        ? 'border-success/30 hover:border-success/50'
                        : 'border-subtle hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        allDone ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'
                      }`}>
                        {allDone ? <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm sm:text-base ${allDone ? 'text-success' : 'text-main'}`}>
                          {section.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-muted">
                          {subSections.length} sub-etapa{subSections.length !== 1 ? 's' : ''} &middot; {allFields.length} campo{allFields.length !== 1 ? 's' : ''}
                          {allDone && <> &middot; <span className="text-success">Concluida</span></>}
                          {!allDone && completedSubs > 0 && <> &middot; {completedSubs}/{subSections.length} concluida{completedSubs !== 1 ? 's' : ''}</>}
                        </p>
                      </div>
                      <FiChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${allDone ? 'text-success' : 'text-muted'}`} />
                    </div>
                  </button>
                )
              }

              // Flat mode (original behavior)
              const progress = sectionProgress.find(sp => sp.section_id === section.id)
              const isDone = progress?.status === 'concluido'
              const sectionFields = getFieldsForSection(section.id)

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => switchSection(section.id)}
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

            {/* Campos Gerais (fields without a section) */}
            {hasGeneralFields && (
              <button
                type="button"
                onClick={() => switchSection(-1)}
                className="w-full text-left card p-3 sm:p-5 transition-all hover:shadow-theme-md cursor-pointer border-subtle hover:border-primary/30"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 bg-primary/10 text-primary">
                    {topLevelSections.length + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-main">Campos Gerais</h3>
                    <p className="text-[10px] sm:text-xs text-muted">
                      {generalFields.length} campo{generalFields.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-muted" />
                </div>
              </button>
            )}
          </div>

          {/* Finalizar Checklist button: always visible */}
          <div className="mt-6">
            <button
              type="button"
              onClick={handlePreFinalize}
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
            <button onClick={handleBackToDashboard} className="btn-ghost w-full py-3 text-center block">
              Voltar ao Dashboard
            </button>
          </div>
        </main>

        {/* Incomplete Checklist Modal (sectioned) */}
        {showIncompleteModal && (
          <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center py-8 px-4">
              <div className="card w-full max-w-md p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                  <FiAlertCircle className="w-8 h-8 text-warning" />
                </div>
                <h2 className="text-xl font-bold text-main mb-2">Checklist Incompleto</h2>
                <p className="text-secondary mb-2">
                  Voce realmente deseja finalizar o checklist <strong>INCOMPLETO</strong>?
                </p>
                <p className="text-sm text-muted mb-4">
                  {emptyRequiredFields.length} campo{emptyRequiredFields.length !== 1 ? 's' : ''} obrigatorio{emptyRequiredFields.length !== 1 ? 's' : ''} nao preenchido{emptyRequiredFields.length !== 1 ? 's' : ''}.
                </p>
                {justificationExpired && (
                  <div className="p-3 bg-error/10 border border-error/30 rounded-xl mb-4">
                    <p className="text-error text-sm font-medium">{justificationExpiredMessage}</p>
                  </div>
                )}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (justificationExpired) {
                        return
                      }
                      setShowIncompleteModal(false)
                      setShowJustificationScreen(true)
                    }}
                    disabled={justificationExpired}
                    className={`w-full py-3 ${justificationExpired ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {justificationExpired ? 'Prazo para justificativa expirou' : 'Sim, justificar e finalizar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIncompleteModal(false)}
                    className="btn-secondary w-full py-3"
                  >
                    Nao, continuar preenchendo
                  </button>
                  <button
                    onClick={handleBackToDashboard}
                    className="btn-ghost w-full py-3 block text-center"
                  >
                    Voltar ao Dashboard (manter pendente)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============ SECTIONED TEMPLATE: FILLING A SPECIFIC SECTION ============
  if (hasSections && activeSection !== null) {
    const isGeneralSection = activeSection === -1
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const section = isGeneralSection ? null : sortedSections.find(s => s.id === activeSection)
    const sectionFields = isGeneralSection
      ? generalFields
      : getFieldsForSection(activeSection).filter(f => f.field_type !== 'gps')
    const progress = isGeneralSection ? null : sectionProgress.find(sp => sp.section_id === activeSection)
    const isDone = isGeneralSection ? false : progress?.status === 'concluido'

    const filledCount = sectionFields.filter(f => {
      const v = responses[f.id]
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    }).length
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const progressPct = sectionFields.length > 0 ? Math.round((filledCount / sectionFields.length) * 100) : 0

    // In hierarchical mode, show parent name as subtitle
    const parentName = hasSubSections && activeParentSection !== null
      ? parentSections.find(s => s.id === activeParentSection)?.name
      : undefined
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const headerSubtitle = parentName ? `${parentName} — ${template.name}` : template.name

    return (
      <div className="min-h-screen bg-page">
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

              {/* Botao para tech users adicionarem campos */}
              {isTechUser && !isDone && (
                <button
                  type="button"
                  onClick={() => {
                    setAddFieldSectionId(activeSection === -1 ? null : activeSection)
                    setShowAddFieldModal(true)
                  }}
                  className="w-full py-3 border-2 border-dashed border-primary/30 hover:border-primary rounded-xl text-primary/70 hover:text-primary transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Adicionar campo nesta etapa</span>
                </button>
              )}

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

        {/* Modal para tech users adicionarem campo (view com secoes) */}
        {showAddFieldModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-page rounded-2xl w-full max-w-md shadow-xl border border-subtle p-6 max-h-[80vh] overflow-y-auto space-y-4">
              <h3 className="text-lg font-bold text-main">Adicionar Campo</h3>
              <p className="text-xs text-muted">O campo sera adicionado permanentemente ao template.</p>

              {/* Nome do campo */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Nome do campo</label>
                <input
                  type="text"
                  value={newFieldName}
                  onChange={e => setNewFieldName(e.target.value)}
                  placeholder="Ex: Verificar temperatura..."
                  className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Tipo</label>
                <select
                  value={newFieldType}
                  onChange={e => {
                    const val = e.target.value as typeof newFieldType
                    setNewFieldType(val)
                    // Reset type-specific states on type change
                    setNewFieldAllowPhoto(false)
                    setNewFieldOnNo({ showTextField: false, textFieldRequired: false, showPhotoField: false, photoFieldRequired: false, allowUserActionPlan: false })
                    setNewFieldOptions([])
                    setNewFieldOptionInput('')
                  }}
                  className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="yes_no">Sim / Nao / N/A</option>
                  <option value="text">Texto</option>
                  <option value="number">Numero</option>
                  <option value="photo">Foto</option>
                  <option value="dropdown">Lista (Dropdown)</option>
                  <option value="checkbox_multiple">Multipla Escolha</option>
                  <option value="rating">Avaliacao (Estrelas)</option>
                  <option value="signature">Assinatura</option>
                </select>
              </div>

              {/* Campo obrigatorio */}
              <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)}
                  className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                Campo obrigatorio
              </label>

              {/* Condicoes para yes_no */}
              {newFieldType === 'yes_no' && (
                <div className="space-y-3 p-3 bg-surface rounded-xl border border-subtle">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Opcoes Sim/Nao</p>
                  <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                    <input type="checkbox" checked={newFieldAllowPhoto} onChange={e => setNewFieldAllowPhoto(e.target.checked)}
                      className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                    Permitir foto
                  </label>
                  <div className="border-t border-subtle pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted">Condicoes &quot;Quando Nao&quot;</p>
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={newFieldOnNo.showTextField} onChange={e => setNewFieldOnNo(prev => ({ ...prev, showTextField: e.target.checked, textFieldRequired: e.target.checked ? prev.textFieldRequired : false }))}
                        className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                      Exigir texto explicativo
                    </label>
                    {newFieldOnNo.showTextField && (
                      <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer ml-6">
                        <input type="checkbox" checked={newFieldOnNo.textFieldRequired} onChange={e => setNewFieldOnNo(prev => ({ ...prev, textFieldRequired: e.target.checked }))}
                          className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                        Texto obrigatorio
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={newFieldOnNo.showPhotoField} onChange={e => setNewFieldOnNo(prev => ({ ...prev, showPhotoField: e.target.checked, photoFieldRequired: e.target.checked ? prev.photoFieldRequired : false }))}
                        className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                      Exigir foto
                    </label>
                    {newFieldOnNo.showPhotoField && (
                      <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer ml-6">
                        <input type="checkbox" checked={newFieldOnNo.photoFieldRequired} onChange={e => setNewFieldOnNo(prev => ({ ...prev, photoFieldRequired: e.target.checked }))}
                          className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                        Foto obrigatoria
                      </label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={newFieldOnNo.allowUserActionPlan} onChange={e => setNewFieldOnNo(prev => ({ ...prev, allowUserActionPlan: e.target.checked }))}
                        className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                      Permitir preenchedor escolher responsavel
                    </label>
                  </div>
                </div>
              )}

              {/* Opcoes para dropdown / checkbox_multiple */}
              {(newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') && (
                <div className="space-y-3 p-3 bg-surface rounded-xl border border-subtle">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">Opcoes da lista</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFieldOptionInput}
                      onChange={e => setNewFieldOptionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newFieldOptionInput.trim()) {
                          e.preventDefault()
                          if (!newFieldOptions.includes(newFieldOptionInput.trim())) {
                            setNewFieldOptions(prev => [...prev, newFieldOptionInput.trim()])
                          }
                          setNewFieldOptionInput('')
                        }
                      }}
                      placeholder="Digite uma opcao..."
                      className="flex-1 px-3 py-2 bg-page border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newFieldOptionInput.trim() && !newFieldOptions.includes(newFieldOptionInput.trim())) {
                          setNewFieldOptions(prev => [...prev, newFieldOptionInput.trim()])
                        }
                        setNewFieldOptionInput('')
                      }}
                      disabled={!newFieldOptionInput.trim()}
                      className="px-3 py-2 btn-primary rounded-xl text-sm disabled:opacity-50"
                    >
                      <FiPlus className="w-4 h-4" />
                    </button>
                  </div>
                  {newFieldOptions.length > 0 && (
                    <div className="space-y-1">
                      {newFieldOptions.map((opt, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-page rounded-lg border border-subtle">
                          <span className="text-sm text-main">{opt}</span>
                          <button
                            type="button"
                            onClick={() => setNewFieldOptions(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-300 text-xs ml-2"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {newFieldOptions.length === 0 && (
                    <p className="text-xs text-muted">Nenhuma opcao adicionada ainda.</p>
                  )}
                </div>
              )}

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Placeholder <span className="text-muted font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={newFieldPlaceholder}
                  onChange={e => setNewFieldPlaceholder(e.target.value)}
                  placeholder="Texto exibido quando o campo esta vazio..."
                  className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Texto de ajuda */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Texto de ajuda <span className="text-muted font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={newFieldHelpText}
                  onChange={e => setNewFieldHelpText(e.target.value)}
                  placeholder="Instrucao para quem preenche o campo..."
                  className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={resetAddFieldModal}
                  className="flex-1 py-2.5 btn-secondary rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddField}
                  disabled={!newFieldName.trim() || addingField || ((newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') && newFieldOptions.length === 0)}
                  className="flex-1 py-2.5 btn-primary rounded-xl text-sm disabled:opacity-50"
                >
                  {addingField ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============ NON-SECTIONED TEMPLATE: ORIGINAL LINEAR FORM ============
  const visibleFields = template.fields.filter(f => f.field_type !== 'gps')

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const progress = visibleFields.length > 0
    ? Math.round((Object.keys(responses).filter(k => {
        const v = responses[Number(k)]
        return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      }).length / visibleFields.length) * 100)
    : 0

  return (
    <div className="min-h-screen bg-page">
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
            <button onClick={handleBackToDashboard} className="btn-ghost w-full py-3 text-center block">
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </main>

      {/* Incomplete Checklist Confirmation Modal */}
      {showIncompleteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center py-8 px-4">
            <div className="card w-full max-w-md p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
                <FiAlertCircle className="w-8 h-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-main mb-2">Checklist Incompleto</h2>
              <p className="text-secondary mb-2">
                Voce realmente deseja finalizar o checklist <strong>INCOMPLETO</strong>?
              </p>
              <p className="text-sm text-muted mb-4">
                {emptyRequiredFields.length} campo{emptyRequiredFields.length !== 1 ? 's' : ''} obrigatorio{emptyRequiredFields.length !== 1 ? 's' : ''} nao preenchido{emptyRequiredFields.length !== 1 ? 's' : ''}.
              </p>
              {justificationExpired && (
                <div className="p-3 bg-error/10 border border-error/30 rounded-xl mb-4">
                  <p className="text-error text-sm font-medium">{justificationExpiredMessage}</p>
                </div>
              )}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (justificationExpired) return
                    setShowIncompleteModal(false)
                    setShowJustificationScreen(true)
                  }}
                  disabled={justificationExpired}
                  className={`w-full py-3 ${justificationExpired ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                >
                  {justificationExpired ? 'Prazo para justificativa expirou' : 'Sim, justificar e finalizar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowIncompleteModal(false)}
                  className="btn-secondary w-full py-3"
                >
                  Nao, continuar preenchendo
                </button>
                <Link
                  href={APP_CONFIG.routes.dashboard}
                  className="btn-ghost w-full py-3 block text-center"
                >
                  Voltar ao Dashboard (manter pendente)
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para tech users adicionarem campo */}
      {showAddFieldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-page rounded-2xl w-full max-w-md shadow-xl border border-subtle p-6 max-h-[80vh] overflow-y-auto space-y-4" style={{ backgroundColor: 'var(--bg-page, #09090b)' }}>
            <h3 className="text-lg font-bold text-main">Adicionar Campo</h3>
            <p className="text-xs text-muted">O campo sera adicionado permanentemente ao template.</p>

            {/* Nome do campo */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Nome do campo</label>
              <input
                type="text"
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                placeholder="Ex: Verificar temperatura..."
                className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Tipo</label>
              <select
                value={newFieldType}
                onChange={e => {
                  const val = e.target.value as typeof newFieldType
                  setNewFieldType(val)
                  // Reset type-specific states on type change
                  setNewFieldAllowPhoto(false)
                  setNewFieldOnNo({ showTextField: false, textFieldRequired: false, showPhotoField: false, photoFieldRequired: false, allowUserActionPlan: false })
                  setNewFieldOptions([])
                  setNewFieldOptionInput('')
                }}
                className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="yes_no">Sim / Nao / N/A</option>
                <option value="text">Texto</option>
                <option value="number">Numero</option>
                <option value="photo">Foto</option>
                <option value="dropdown">Lista (Dropdown)</option>
                <option value="checkbox_multiple">Multipla Escolha</option>
                <option value="rating">Avaliacao (Estrelas)</option>
                <option value="signature">Assinatura</option>
              </select>
            </div>

            {/* Campo obrigatorio */}
            <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
              <input type="checkbox" checked={newFieldRequired} onChange={e => setNewFieldRequired(e.target.checked)}
                className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
              Campo obrigatorio
            </label>

            {/* Condicoes para yes_no */}
            {newFieldType === 'yes_no' && (
              <div className="space-y-3 p-3 bg-surface rounded-xl border border-subtle">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">Opcoes Sim/Nao</p>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                  <input type="checkbox" checked={newFieldAllowPhoto} onChange={e => setNewFieldAllowPhoto(e.target.checked)}
                    className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                  Permitir foto
                </label>
                <div className="border-t border-subtle pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted">Condicoes &quot;Quando Nao&quot;</p>
                  <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                    <input type="checkbox" checked={newFieldOnNo.showTextField} onChange={e => setNewFieldOnNo(prev => ({ ...prev, showTextField: e.target.checked, textFieldRequired: e.target.checked ? prev.textFieldRequired : false }))}
                      className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                    Exigir texto explicativo
                  </label>
                  {newFieldOnNo.showTextField && (
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer ml-6">
                      <input type="checkbox" checked={newFieldOnNo.textFieldRequired} onChange={e => setNewFieldOnNo(prev => ({ ...prev, textFieldRequired: e.target.checked }))}
                        className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                      Texto obrigatorio
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                    <input type="checkbox" checked={newFieldOnNo.showPhotoField} onChange={e => setNewFieldOnNo(prev => ({ ...prev, showPhotoField: e.target.checked, photoFieldRequired: e.target.checked ? prev.photoFieldRequired : false }))}
                      className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                    Exigir foto
                  </label>
                  {newFieldOnNo.showPhotoField && (
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer ml-6">
                      <input type="checkbox" checked={newFieldOnNo.photoFieldRequired} onChange={e => setNewFieldOnNo(prev => ({ ...prev, photoFieldRequired: e.target.checked }))}
                        className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                      Foto obrigatoria
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                    <input type="checkbox" checked={newFieldOnNo.allowUserActionPlan} onChange={e => setNewFieldOnNo(prev => ({ ...prev, allowUserActionPlan: e.target.checked }))}
                      className="w-4 h-4 rounded border-subtle text-primary focus:ring-primary" />
                    Permitir preenchedor escolher responsavel
                  </label>
                </div>
              </div>
            )}

            {/* Opcoes para dropdown / checkbox_multiple */}
            {(newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') && (
              <div className="space-y-3 p-3 bg-surface rounded-xl border border-subtle">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">Opcoes da lista</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFieldOptionInput}
                    onChange={e => setNewFieldOptionInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newFieldOptionInput.trim()) {
                        e.preventDefault()
                        if (!newFieldOptions.includes(newFieldOptionInput.trim())) {
                          setNewFieldOptions(prev => [...prev, newFieldOptionInput.trim()])
                        }
                        setNewFieldOptionInput('')
                      }
                    }}
                    placeholder="Digite uma opcao..."
                    className="flex-1 px-3 py-2 bg-page border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newFieldOptionInput.trim() && !newFieldOptions.includes(newFieldOptionInput.trim())) {
                        setNewFieldOptions(prev => [...prev, newFieldOptionInput.trim()])
                      }
                      setNewFieldOptionInput('')
                    }}
                    disabled={!newFieldOptionInput.trim()}
                    className="px-3 py-2 btn-primary rounded-xl text-sm disabled:opacity-50"
                  >
                    <FiPlus className="w-4 h-4" />
                  </button>
                </div>
                {newFieldOptions.length > 0 && (
                  <div className="space-y-1">
                    {newFieldOptions.map((opt, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-page rounded-lg border border-subtle">
                        <span className="text-sm text-main">{opt}</span>
                        <button
                          type="button"
                          onClick={() => setNewFieldOptions(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-300 text-xs ml-2"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {newFieldOptions.length === 0 && (
                  <p className="text-xs text-muted">Nenhuma opcao adicionada ainda.</p>
                )}
              </div>
            )}

            {/* Placeholder */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Placeholder <span className="text-muted font-normal">(opcional)</span></label>
              <input
                type="text"
                value={newFieldPlaceholder}
                onChange={e => setNewFieldPlaceholder(e.target.value)}
                placeholder="Texto exibido quando o campo esta vazio..."
                className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Texto de ajuda */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Texto de ajuda <span className="text-muted font-normal">(opcional)</span></label>
              <input
                type="text"
                value={newFieldHelpText}
                onChange={e => setNewFieldHelpText(e.target.value)}
                placeholder="Instrucao para quem preenche o campo..."
                className="w-full px-3 py-2 bg-surface border border-subtle rounded-xl text-main text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={resetAddFieldModal}
                className="flex-1 py-2.5 btn-secondary rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddField}
                disabled={!newFieldName.trim() || addingField || ((newFieldType === 'dropdown' || newFieldType === 'checkbox_multiple') && newFieldOptions.length === 0)}
                className="flex-1 py-2.5 btn-primary rounded-xl text-sm disabled:opacity-50"
              >
                {addingField ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
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
