'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { Select, Modal } from '@/components/ui'
import { NodeCard } from '@/components/admin/NodeCard'
import { SectionCard } from '@/components/admin/SectionCard'
import { ConnectionLines } from '@/components/admin/ConnectionLines'
import { SectionEditModal } from '@/components/admin/SectionEditModal'
import Link from 'next/link'
import {
  FiSettings,
  FiGrid,
  FiBriefcase,
  FiShield,
  FiArrowLeft,
  FiHome,
} from 'react-icons/fi'
import type { Store, FieldType, TemplateCategory, Sector, FunctionRow } from '@/types/database'
import { type ConditionConfig, type PresetOption } from '@/components/admin/FieldConditionEditor'

// ─── Tipos locais ────────────────────────────────────────────────────────────

/** Configuracao de uma etapa ou sub-etapa do template.
 *  Etapas (parent_id=null) agrupam sub-etapas (parent_id=<etapa_id>).
 *  Campos sao atribuidos a sub-etapas ou diretamente a etapas sem sub-etapas. */
type SectionConfig = {
  id: string
  name: string
  description: string
  sort_order: number
  parent_id: string | null // null = etapa raiz; string = id da etapa pai
}

/** Campo individual de um template. */
type FieldConfig = {
  id: string
  section_id: string | null // id local da etapa/sub-etapa a que pertence
  name: string
  field_type: FieldType
  is_required: boolean
  sort_order: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any
  validation: Record<string, unknown> | null
  placeholder: string
  help_text: string
}

/** Par loja/setor que define onde o template fica visivel. */
type VisibilityConfig = {
  store_id: number
  sector_id: number | null
  function_id: number | null
}

type SectorWithStore = Sector & {
  store: Store
}

// SortableItem movido para SectionEditModal e SectionCard

export default function NovoTemplatePage() {
  const [stores, setStores] = useState<Store[]>([])
  const [sectors, setSectors] = useState<SectorWithStore[]>([])
  const [functions, setFunctions] = useState<FunctionRow[]>([])
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Template form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('recebimento')
  const [adminOnly, setAdminOnly] = useState(false)
  const [skipJustifications, setSkipJustifications] = useState(false)

  // Time settings
  const [allowedStartTime, setAllowedStartTime] = useState('')
  const [allowedEndTime, setAllowedEndTime] = useState('')
  const [justificationDeadlineHours, setJustificationDeadlineHours] = useState('')

  // Sections
  const [sections, setSections] = useState<SectionConfig[]>([])

  // Fields
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldConditions, setFieldConditions] = useState<Record<string, ConditionConfig | null>>({})
  const [conditionFunctions, setConditionFunctions] = useState<{ id: number; name: string }[]>([])
  const [conditionPresets, setConditionPresets] = useState<PresetOption[]>([])

  // Visibility - now includes sector_id
  const [visibility, setVisibility] = useState<VisibilityConfig[]>([])
  const [showSectorModal, setShowSectorModal] = useState(false)
  const [showFunctionModal, setShowFunctionModal] = useState(false)
  const { refreshKey } = useRealtimeRefresh(['template_fields'])
  const [reloadTrigger, setReloadTrigger] = useState(0)

  // Flow builder state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (refreshKey > 0 && navigator.onLine) setReloadTrigger(prev => prev + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  useEffect(() => {
    const fetchData = async () => {
      // Fetch stores
      const { data: storesData } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (storesData) setStores(storesData)

      // Fetch sectors with their stores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectorsData } = await (supabase as any)
        .from('sectors')
        .select(`
          *,
          store:stores(*)
        `)
        .eq('is_active', true)
        .order('name')

      if (sectorsData) setSectors(sectorsData)

      // Fetch functions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: functionsData } = await (supabase as any)
        .from('functions')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (functionsData) setFunctions(functionsData as FunctionRow[])

      // Fetch functions for condition editor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: condFunctionsData } = await (supabase as any)
        .from('functions')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      if (condFunctionsData && condFunctionsData.length > 0) {
        setConditionFunctions((condFunctionsData as { id: number; name: string }[]).map((f) => ({ id: f.id, name: f.name })))
      }

      // Fetch presets for condition editor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: presetsData } = await (supabase as any)
        .from('action_plan_presets')
        .select('id, name, severity, deadline_days, default_function_id, description_template, require_photo_on_completion, require_text_on_completion, completion_max_chars')
        .eq('is_active', true)
        .order('name')
      if (presetsData) {
        setConditionPresets((presetsData as { id: number; name: string; severity: string; deadline_days: number; default_function_id: number | null; description_template: string | null; require_photo_on_completion?: boolean; require_text_on_completion?: boolean; completion_max_chars?: number }[]).map((p) => ({
          id: p.id,
          name: p.name,
          severity: p.severity as PresetOption['severity'],
          deadlineDays: p.deadline_days,
          defaultAssigneeId: null,
          defaultFunctionId: p.default_function_id,
          descriptionTemplate: p.description_template || '',
          requirePhotoOnCompletion: p.require_photo_on_completion || false,
          requireTextOnCompletion: p.require_text_on_completion || false,
          completionMaxChars: p.completion_max_chars || 800,
        })))
      }
    }

    fetchData()
  }, [supabase, reloadTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const fieldTypes: { value: FieldType; label: string; icon: string }[] = [
    { value: 'text', label: 'Texto', icon: 'Aa' },
    { value: 'number', label: 'Numero', icon: '#' },
    { value: 'photo', label: 'Foto', icon: '📷' },
    { value: 'dropdown', label: 'Lista', icon: '▼' },
    { value: 'signature', label: 'Assinatura', icon: '✍️' },
    { value: 'datetime', label: 'Data/Hora', icon: '📅' },
    { value: 'checkbox_multiple', label: 'Multipla Escolha', icon: '☑️' },
    { value: 'barcode', label: 'Codigo de Barras', icon: '▮▯▮' },
    { value: 'calculated', label: 'Calculado', icon: '∑' },
    { value: 'yes_no', label: 'Sim/Nao/N/A', icon: '?!' },
    { value: 'rating', label: 'Avaliacao', icon: '😊' },
  ]

  // Get sectors for a specific store
  const getSectorsForStore = (storeId: number) => {
    return sectors.filter(s => s.store_id === storeId)
  }

  // ─── Hierarquia de etapas / sub-etapas ──────────────────────────────────────
  /** Etapas raiz (nivel 1) — sem parent_id */
  const parentSections = sections.filter(s => !s.parent_id)
  /** Sub-etapas de uma etapa pai, ordenadas */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getSubSections = (parentId: string) =>
    sections.filter(s => s.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

  /** Cria nova etapa raiz */
  const addSection = () => {
    setSections([...sections, {
      id: `section_${Date.now()}`,
      name: '',
      description: '',
      sort_order: sections.length + 1,
      parent_id: null,
    }])
  }

  /** Cria nova sub-etapa dentro de uma etapa pai */
  const addSubSection = (parentId: string) => {
    const newSub: SectionConfig = {
      id: `section_${Date.now()}`,
      name: '',
      description: '',
      sort_order: sections.length + 1,
      parent_id: parentId,
    }
    setSections([...sections, newSub])
    // expandedSubSection removed — sections are now edited via SectionEditModal
  }

  const updateSection = (id: string, updates: Partial<SectionConfig>) => {
    setSections(sections.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  /** Remove etapa ou sub-etapa. Se for etapa pai, remove em cascata. */
  const removeSection = (id: string) => {
    const section = sections.find(s => s.id === id)
    if (!section) return

    if (!section.parent_id) {
      // Etapa pai: remove ela + todas sub-etapas + desvincula campos
      if (!confirm('Deseja realmente excluir esta etapa e todas as suas sub-etapas?')) return
      const childIds = sections.filter(s => s.parent_id === id).map(s => s.id)
      setSections(sections.filter(s => s.id !== id && s.parent_id !== id))
      setFields(fields.map(f =>
        (f.section_id === id || childIds.includes(f.section_id || ''))
          ? { ...f, section_id: null }
          : f
      ))
    } else {
      // Sub-etapa: remove apenas ela + desvincula seus campos
      if (!confirm('Deseja realmente excluir esta sub-etapa? Os campos dela ficarao sem etapa.')) return
      setSections(sections.filter(s => s.id !== id))
      setFields(fields.map(f => f.section_id === id ? { ...f, section_id: null } : f))
    }
  }

  const addField = (type: FieldType, sectionId?: string | null) => {
    const newField: FieldConfig = {
      id: `field_${Date.now()}`,
      section_id: sectionId || null,
      name: '',
      field_type: type,
      is_required: true,
      sort_order: fields.length + 1,
      options: type === 'dropdown' || type === 'checkbox_multiple' ? [] : type === 'number' ? { numberSubtype: 'decimal' } : null,
      validation: null,
      placeholder: '',
      help_text: '',
    }
    setFields([...fields, newField])
    setEditingField(newField.id)
  }

  const updateField = (id: string, updates: Partial<FieldConfig>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const removeField = (id: string) => {
    if (!confirm('Deseja realmente excluir este campo?')) return
    setFields(fields.filter(f => f.id !== id))
    if (editingField === id) setEditingField(null)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getFieldIcon = (field: FieldConfig): string | null => {
    if (field.options && typeof field.options === 'object' && !Array.isArray(field.options)) {
      return (field.options as Record<string, unknown>).icon as string | null || null
    }
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setFieldIcon = (fieldId: string, iconName: string | null) => {
    setFields(fields.map(f => {
      if (f.id !== fieldId) return f
      if (Array.isArray(f.options)) {
        return { ...f, options: iconName ? { items: f.options, icon: iconName } : f.options }
      } else if (f.options && typeof f.options === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts = { ...(f.options as any), icon: iconName }
        if (!iconName) delete opts.icon
        return { ...f, options: Object.keys(opts).length === 0 ? null : opts }
      } else {
        return iconName ? { ...f, options: { icon: iconName } } : f
      }
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  const getOptionsItems = (options: any): string[] => {
    if (Array.isArray(options)) return options
    if (options && typeof options === 'object' && 'items' in options) {
      return options.items as string[]
    }
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serializeOptions = (options: any): any => {
    if (Array.isArray(options)) return options.filter((o: string) => o.trim())
    if (options && typeof options === 'object' && 'items' in options) {
      return { ...options, items: (options.items as string[]).filter((o: string) => o.trim()) }
    }
    return options
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const changeFieldType = (id: string, newType: FieldType) => {
    const currentIcon = getFieldIcon(fields.find(f => f.id === id)!)
    let defaultOptions: unknown = (newType === 'dropdown' || newType === 'checkbox_multiple') ? [] : newType === 'number' ? { numberSubtype: 'decimal' } : null
    if (currentIcon) {
      if (Array.isArray(defaultOptions)) {
        defaultOptions = { items: defaultOptions, icon: currentIcon }
      } else if (defaultOptions && typeof defaultOptions === 'object') {
        defaultOptions = { ...(defaultOptions as Record<string, unknown>), icon: currentIcon }
      } else {
        defaultOptions = { icon: currentIcon }
      }
    }
    setFields(fields.map(f => f.id === id ? { ...f, field_type: newType, options: defaultOptions } : f))
  }

  // Toggle a sector's visibility
  const toggleSectorVisibility = (storeId: number, sectorId: number) => {
    const existing = visibility.find(v => v.store_id === storeId && v.sector_id === sectorId)
    if (existing) {
      setVisibility(visibility.filter(v => !(v.store_id === storeId && v.sector_id === sectorId)))
    } else {
      setVisibility([...visibility, { store_id: storeId, sector_id: sectorId, function_id: null }])
    }
  }

  // Check if a sector is enabled
  const isSectorEnabled = (storeId: number, sectorId: number) => {
    return visibility.some(v => v.store_id === storeId && v.sector_id === sectorId)
  }

  // Toggle all sectors of a store
  const toggleAllStoreSectors = (storeId: number) => {
    const storeSectors = getSectorsForStore(storeId)
    const allEnabled = storeSectors.every(s => isSectorEnabled(storeId, s.id))

    if (allEnabled) {
      // Remove all sectors of this store
      setVisibility(visibility.filter(v => v.store_id !== storeId))
    } else {
      // Add all sectors of this store
      const newVisibility = visibility.filter(v => v.store_id !== storeId)
      storeSectors.forEach(sector => {
        newVisibility.push({ store_id: storeId, sector_id: sector.id, function_id: null })
      })
      setVisibility(newVisibility)
    }
  }

  // Check if any sector of a store is enabled
  const isStorePartiallyEnabled = (storeId: number) => {
    return visibility.some(v => v.store_id === storeId)
  }

  // Check if all sectors of a store are enabled
  const isStoreFullyEnabled = (storeId: number) => {
    const storeSectors = getSectorsForStore(storeId)
    return storeSectors.length > 0 && storeSectors.every(s => isSectorEnabled(storeId, s.id))
  }

  const handleSaveAsPreset = async (data: { name: string; severity: string; deadlineDays: number; defaultFunctionId: number | null; descriptionTemplate: string }) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: preset, error: presetErr } = await (supabase as any)
        .from('action_plan_presets')
        .insert({
          name: data.name,
          severity: data.severity,
          deadline_days: data.deadlineDays,
          default_function_id: data.defaultFunctionId,
          description_template: data.descriptionTemplate,
          is_active: true,
        })
        .select('id, name, severity, deadline_days, default_function_id, description_template, require_photo_on_completion, require_text_on_completion, completion_max_chars')
        .single()

      if (presetErr) throw presetErr

      setConditionPresets(prev => [...prev, {
        id: preset.id,
        name: preset.name,
        severity: preset.severity as PresetOption['severity'],
        deadlineDays: preset.deadline_days,
        defaultAssigneeId: null,
        defaultFunctionId: preset.default_function_id,
        descriptionTemplate: preset.description_template || '',
        requirePhotoOnCompletion: preset.require_photo_on_completion || false,
        requireTextOnCompletion: preset.require_text_on_completion || false,
        completionMaxChars: preset.completion_max_chars || 800,
      }])

      alert('Modelo salvo com sucesso!')
    } catch (err) {
      console.error('[Template] Erro ao salvar modelo:', err)
      alert('Erro ao salvar modelo. Tente novamente.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (fields.length === 0) {
      setError('Adicione pelo menos um campo ao checklist')
      setLoading(false)
      return
    }

    if (fields.some(f => !f.name.trim())) {
      setError('Todos os campos precisam ter um nome')
      setLoading(false)
      return
    }

    if (visibility.length === 0) {
      setError('Selecione pelo menos um setor para visibilidade')
      setLoading(false)
      return
    }

    try {
      // 1. Create template
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: template, error: templateError } = await (supabase as any)
        .from('checklist_templates')
        .insert({
          name,
          description: description || null,
          category,
          admin_only: adminOnly,
          skip_justifications: skipJustifications,
          allowed_start_time: allowedStartTime || null,
          allowed_end_time: allowedEndTime || null,
          justification_deadline_hours: justificationDeadlineHours ? Number(justificationDeadlineHours) : null,
        })
        .select()
        .single()

      if (templateError) throw templateError

      // 2. Criar etapas/sub-etapas — pais primeiro para obter IDs, depois filhas com parent_id
      const sectionIdMap: Record<string, number> = {} // id local → id do banco
      if (sections.length > 0) {
        // Insert parent sections first (parent_id = null)
        const parents = sections.filter(s => !s.parent_id)
        if (parents.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: parentData, error: parentErr } = await (supabase as any)
            .from('template_sections')
            .insert(parents.map(s => ({
              template_id: template.id,
              name: s.name,
              description: s.description || null,
              sort_order: s.sort_order,
            })))
            .select()
          if (parentErr) throw parentErr
          if (parentData) {
            parents.forEach((s, i) => { sectionIdMap[s.id] = parentData[i].id })
          }
        }

        // Insert sub-sections with parent_id
        const children = sections.filter(s => s.parent_id)
        if (children.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: childData, error: childErr } = await (supabase as any)
            .from('template_sections')
            .insert(children.map(s => ({
              template_id: template.id,
              name: s.name,
              description: s.description || null,
              sort_order: s.sort_order,
              parent_id: s.parent_id ? sectionIdMap[s.parent_id] || null : null,
            })))
            .select()
          if (childErr) throw childErr
          if (childData) {
            children.forEach((s, i) => { sectionIdMap[s.id] = childData[i].id })
          }
        }
      }

      // 3. Create fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: insertedFields, error: fieldsError } = await (supabase as any)
        .from('template_fields')
        .insert(
          fields.map(f => ({
            template_id: template.id,
            section_id: f.section_id ? sectionIdMap[f.section_id] || null : null,
            name: f.name,
            field_type: f.field_type,
            is_required: f.is_required,
            sort_order: f.sort_order,
            options: serializeOptions(f.options),
            validation: f.validation,
            placeholder: f.placeholder || null,
            help_text: f.help_text || null,
          }))
        )
        .select()

      if (fieldsError) throw fieldsError

      // 3b. Save field conditions
      if (insertedFields) {
        const conditionsToInsert: { field_id: number; condition_type: string; condition_value: Record<string, unknown>; severity: string; default_function_id: number | null; deadline_days: number; description_template: string | null; is_active: boolean; require_photo_on_completion: boolean; require_text_on_completion: boolean; completion_max_chars: number }[] = []
        fields.forEach((f, idx) => {
          const cond = fieldConditions[f.id]
          if (cond && insertedFields[idx]) {
            conditionsToInsert.push({
              field_id: insertedFields[idx].id,
              condition_type: cond.conditionType,
              condition_value: cond.conditionValue,
              severity: cond.severity,
              default_function_id: cond.defaultFunctionId,
              deadline_days: cond.deadlineDays,
              description_template: cond.descriptionTemplate || null,
              is_active: true,
              require_photo_on_completion: cond.requirePhotoOnCompletion || false,
              require_text_on_completion: cond.requireTextOnCompletion || false,
              completion_max_chars: cond.completionMaxChars || 800,
            })
          }
        })
        if (conditionsToInsert.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('field_conditions').insert(conditionsToInsert)
        }
      }

      // 3. Create visibility with sector_id and optional function_id
      if (visibility.length > 0) {
        const visibilityEntries: { template_id: number; store_id: number; sector_id: number | null; function_id: number | null; roles: string[] }[] = []

        if (selectedFunctionIds.length === 0) {
          visibility.forEach(v => {
            visibilityEntries.push({
              template_id: template.id,
              store_id: v.store_id,
              sector_id: v.sector_id,
              function_id: null,
              roles: [],
            })
          })
        } else {
          visibility.forEach(v => {
            selectedFunctionIds.forEach(fnId => {
              visibilityEntries.push({
                template_id: template.id,
                store_id: v.store_id,
                sector_id: v.sector_id,
                function_id: fnId,
                roles: [],
              })
            })
          })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: visError } = await (supabase as any)
          .from('template_visibility')
          .insert(visibilityEntries)

        if (visError) throw visError
      }

      router.push(APP_CONFIG.routes.adminTemplates)
    } catch (err) {
      console.error('Error creating template:', err)
      const supaErr = err as { message?: string; details?: string; code?: string }
      const msg = supaErr?.message || supaErr?.details || 'Erro ao criar checklist'
      setError(msg)
      setLoading(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getFieldTypeLabel = (type: FieldType) => {
    return fieldTypes.find(f => f.value === type)?.label || type
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getFieldTypeIcon = (type: FieldType) => {
    return fieldTypes.find(f => f.value === type)?.icon || '?'
  }

  // ─── Flow builder handlers ──────────────────────────────────────────────────

  /** Toggle store visibility (from NodeCard) */
  const handleStoreToggle = (storeId: number | string) => {
    const id = Number(storeId)
    const hasStore = visibility.some(v => v.store_id === id)
    if (hasStore) {
      setVisibility(prev => prev.filter(v => v.store_id !== id))
    } else {
      const storeSectors = sectors.filter(s => s.store_id === id)
      const newEntries: VisibilityConfig[] = storeSectors.map(s => ({ store_id: id, sector_id: s.id, function_id: null }))
      if (newEntries.length === 0) newEntries.push({ store_id: id, sector_id: null as unknown as number, function_id: null })
      setVisibility(prev => [...prev, ...newEntries])
    }
  }

  /** Toggle sector visibility (from NodeCard) */
  const handleSectorToggle = (sectorId: number | string) => {
    const id = Number(sectorId)
    const hasSector = visibility.some(v => v.sector_id === id)
    if (hasSector) {
      setVisibility(prev => prev.filter(v => v.sector_id !== id))
    } else {
      const sector = sectors.find(s => s.id === id)
      if (sector) setVisibility(prev => [...prev, { store_id: sector.store_id, sector_id: id, function_id: null }])
    }
  }

  /** Toggle function (from NodeCard) */
  const handleFunctionToggle = (functionId: number | string) => {
    const id = Number(functionId)
    setSelectedFunctionIds(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  /** Section reorder from SectionCard */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSectionReorder = (reorderedSections: any[]) => {
    setSections(prev => {
      const updated = [...prev]
      reorderedSections.forEach((rs: { id: string }, idx: number) => {
        const section = updated.find(s => s.id === rs.id)
        if (section) section.sort_order = idx + 1
      })
      return updated.sort((a, b) => a.sort_order - b.sort_order)
    })
  }

  /** Wrapper: add section (for SectionCard) */
  const handleAddSection = () => addSection()

  /** Wrapper: update section (for SectionEditModal) */
  const handleSectionUpdate = (id: string, updates: Partial<{ name: string; description: string }>) => {
    updateSection(id, updates)
  }

  /** Wrapper: add sub-section (for SectionEditModal) */
  const handleAddSubSection = (parentId: string) => addSubSection(parentId)

  /** Wrapper: delete sub-section (for SectionEditModal) */
  const handleDeleteSubSection = (id: string) => removeSection(id)

  /** Wrapper: add field to section (for SectionEditModal) */
  const handleAddField = (sectionId: string) => addField('text', sectionId === '__loose__' ? null : sectionId)

  /** Wrapper: update field (for SectionEditModal) */
  const handleFieldUpdate = (fieldId: string, updates: Partial<FieldConfig>) => updateField(fieldId, updates)

  /** Wrapper: delete field (for SectionEditModal) */
  const handleDeleteField = (fieldId: string) => removeField(fieldId)

  /** Wrapper: reorder fields (for SectionEditModal) */
  const handleFieldReorder = (reorderedFields: FieldConfig[]) => {
    const sortMap = new Map(reorderedFields.map((f, i) => [f.id, i + 1]))
    setFields(prev => prev.map(f => sortMap.has(f.id) ? { ...f, sort_order: sortMap.get(f.id)! } : f))
  }

  /** Handle save (wrapper for form submit without event) */
  const handleSave = () => {
    // Trigger the same logic as handleSubmit but without form event
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    handleSubmit(fakeEvent)
  }

  /** Sub-sections of a given parent (for SectionCard field counting) */
  const subSectionsOf = (parentId: string) =>
    sections.filter(s => s.parent_id === parentId)

  /** Relevant sectors: sectors from stores that have visibility */
  const relevantSectors = sectors.filter(s => {
    const storeIds = [...new Set(visibility.map(v => v.store_id))]
    return storeIds.includes(s.store_id)
  })

  /** Connection lines: link left/right nodes to center card */
  const connections = useMemo(() => {
    const lines: { from: string; to: string; color?: string }[] = []
    // Left nodes -> center
    if (visibility.length > 0) {
      lines.push({ from: 'left-lojas', to: 'center', color: '#0D9488' })
      if (relevantSectors.length > 0) {
        lines.push({ from: 'left-setores', to: 'center', color: '#0D9488' })
      }
    }
    // Right nodes -> center
    if (selectedFunctionIds.length > 0 || adminOnly) {
      lines.push({ from: 'right-funcoes', to: 'center', color: '#F59E0B' })
    }
    lines.push({ from: 'right-configuracoes', to: 'center', color: '#64748B' })
    return lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility.length, relevantSectors.length, selectedFunctionIds.length, adminOnly])

  /** Category options for the header Select */
  const categoryOptions = [
    { value: 'recebimento', label: 'Recebimento' },
    { value: 'limpeza',     label: 'Limpeza' },
    { value: 'abertura',    label: 'Abertura' },
    { value: 'fechamento',  label: 'Fechamento' },
    { value: 'outros',      label: 'Outros' },
  ]

  return (
    <div className="min-h-screen bg-page flex flex-col">
      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="bg-surface border-b border-subtle px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(APP_CONFIG.routes.adminTemplates)}
            className="p-2 text-muted hover:text-main rounded-lg transition-colors"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nome do template..."
            className="flex-1 text-xl font-bold bg-transparent border-none outline-none text-main placeholder-muted"
          />
          <Select
            value={category}
            onChange={v => setCategory(v as TemplateCategory)}
            options={categoryOptions}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="btn-primary px-6 py-2.5 rounded-xl font-medium"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-error">{error}</div>}
      </header>

      {/* ─── Flow Canvas ─────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden" ref={canvasRef}>
        <ConnectionLines connections={connections} containerRef={canvasRef} />

        <div className="h-full grid grid-cols-1 md:grid-cols-[208px_1fr_208px] gap-6 p-6 items-start content-start">
          {/* LEFT COLUMN: Lojas + Setores */}
          <div className="flex flex-col gap-4">
            <NodeCard
              title="Lojas"
              icon={<FiHome />}
              items={stores.map(s => ({
                id: s.id,
                label: s.name,
                checked: visibility.some(v => v.store_id === s.id),
              }))}
              onToggle={handleStoreToggle}
              selectable
              position="left"
              draggable
              onHeaderClick={() => setShowSectorModal(true)}
            />
            <NodeCard
              title="Setores"
              icon={<FiGrid />}
              items={relevantSectors.map(s => ({
                id: s.id,
                label: s.name,
                checked: visibility.some(v => v.sector_id === s.id),
              }))}
              onToggle={handleSectorToggle}
              selectable
              position="left"
              draggable
              onHeaderClick={() => setShowSectorModal(true)}
            />
          </div>

          {/* CENTER: Section Card */}
          <div className="flex justify-center">
            <SectionCard
              templateName={name || 'Novo Template'}
              sections={parentSections.map(s => ({
                id: s.id,
                name: s.name,
                fieldCount: fields.filter(f =>
                  f.section_id === s.id || subSectionsOf(s.id).some(sub => f.section_id === sub.id)
                ).length,
                subSectionCount: sections.filter(sub => sub.parent_id === s.id).length,
                sort_order: s.sort_order,
              }))}
              onSectionClick={(sectionId) => setEditingSectionId(sectionId)}
              onAddSection={handleAddSection}
              onReorder={handleSectionReorder}
              looseFields={fields.filter(f => !f.section_id).map(f => ({ id: f.id, name: f.name, field_type: f.field_type }))}
              onLooseFieldsClick={() => setEditingSectionId('__loose__')}
              onAddField={() => handleAddField('__loose__')}
            />
          </div>

          {/* RIGHT COLUMN: Funcoes + Config */}
          <div className="flex flex-col gap-4">
            <NodeCard
              title="Funções"
              icon={<FiBriefcase />}
              items={functions.map(f => ({
                id: f.id,
                label: f.name,
                checked: selectedFunctionIds.includes(f.id),
                color: f.color,
              }))}
              onToggle={handleFunctionToggle}
              selectable
              position="right"
              draggable
              onHeaderClick={() => setShowFunctionModal(true)}
            />
            <NodeCard
              title="Configurações"
              icon={<FiSettings />}
              items={[
                { id: 'desc', label: description || 'Sem descricao' },
                { id: 'time', label: allowedStartTime ? `${allowedStartTime} - ${allowedEndTime}` : 'Sem restricao horario' },
                { id: 'justif', label: skipJustifications ? 'Sem justificativas' : 'Com justificativas' },
                { id: 'admin', label: adminOnly ? 'Somente admin' : 'Todos os usuarios' },
              ]}
              position="right"
              draggable
              onHeaderClick={() => setShowConfigModal(true)}
            />
          </div>
        </div>
      </div>

      {/* ─── Section Edit Modal ──────────────────────────────────────────── */}
      <SectionEditModal
        isOpen={!!editingSectionId}
        onClose={() => setEditingSectionId(null)}
        section={editingSectionId === '__loose__'
          ? { id: '__loose__', name: 'Campos Gerais', description: 'Campos sem etapa' }
          : sections.find(s => s.id === editingSectionId) || null}
        subSections={editingSectionId === '__loose__' ? [] : sections.filter(s => s.parent_id === editingSectionId)}
        fields={editingSectionId === '__loose__'
          ? fields.filter(f => !f.section_id)
          : fields.filter(f =>
              f.section_id === editingSectionId ||
              sections.filter(s => s.parent_id === editingSectionId).some(sub => f.section_id === sub.id)
            )}
        onSectionUpdate={handleSectionUpdate}
        onSubSectionAdd={handleAddSubSection}
        onSubSectionDelete={handleDeleteSubSection}
        onFieldAdd={handleAddField}
        onFieldUpdate={handleFieldUpdate}
        onFieldDelete={handleDeleteField}
        onFieldReorder={handleFieldReorder}
        fieldConditions={fieldConditions}
        onConditionChange={(fieldId, cond) => setFieldConditions(prev => ({ ...prev, [fieldId]: cond }))}
        conditionFunctions={conditionFunctions}
        conditionPresets={conditionPresets}
        onSaveAsPreset={handleSaveAsPreset}
        editingField={editingField}
        onEditField={setEditingField}
      />

      {/* ─── Existing Modals (Sector/Function) ──────────────────────────── */}
      <Modal isOpen={showSectorModal} onClose={() => setShowSectorModal(false)} title="Visibilidade por Setor" size="lg">
        <p className="text-sm text-muted mb-4">
          Selecione em quais setores este checklist estará disponível.
          Apenas usuarios dos setores selecionados poderao preencher.
        </p>

        <div className="space-y-4">
          {stores.map(store => {
            const storeSectors = getSectorsForStore(store.id)
            const isFullyEnabled = isStoreFullyEnabled(store.id)
            const isPartiallyEnabled = isStorePartiallyEnabled(store.id)

            return (
              <div
                key={store.id}
                className={`rounded-xl border transition-all ${
                  isPartiallyEnabled
                    ? 'border-primary bg-primary/5'
                    : 'border-subtle bg-surface'
                }`}
              >
                <div className="p-4 flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFullyEnabled}
                      ref={input => {
                        if (input) {
                          input.indeterminate = isPartiallyEnabled && !isFullyEnabled
                        }
                      }}
                      onChange={() => toggleAllStoreSectors(store.id)}
                      className="w-5 h-5 rounded border-default bg-surface text-primary focus:ring-primary"
                    />
                    <span className={isPartiallyEnabled ? 'text-main font-medium' : 'text-secondary'}>
                      {store.name}
                    </span>
                  </label>
                  <span className="text-xs text-muted">
                    {storeSectors.filter(s => isSectorEnabled(store.id, s.id)).length} / {storeSectors.length} setores
                  </span>
                </div>

                {storeSectors.length > 0 && (
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    {storeSectors.map(sector => (
                      <label
                        key={sector.id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                          isSectorEnabled(store.id, sector.id)
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-surface-hover text-muted border border-transparent hover:border-subtle'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSectorEnabled(store.id, sector.id)}
                          onChange={() => toggleSectorVisibility(store.id, sector.id)}
                          className="sr-only"
                        />
                        <FiGrid className="w-4 h-4" style={{ color: sector.color }} />
                        {sector.name}
                      </label>
                    ))}
                  </div>
                )}

                {storeSectors.length === 0 && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-muted">
                      Nenhum setor cadastrado nesta loja.{' '}
                      <Link href={APP_CONFIG.routes.adminSectors} className="text-primary hover:underline">
                        Criar setor
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {visibility.length > 0 && (
          <div className="mt-4 p-3 bg-success/10 rounded-lg">
            <p className="text-sm text-success">
              {visibility.length} setor{visibility.length > 1 ? 'es' : ''} selecionado{visibility.length > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </Modal>

      <Modal isOpen={showFunctionModal} onClose={() => setShowFunctionModal(false)} title="Restringir por Funcao" size="md">
        <p className="text-sm text-muted mb-4">
          Se nenhuma função for selecionada, o checklist estará disponível para todas as funções.
        </p>

        <div className="flex flex-wrap gap-2">
          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
              adminOnly
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-surface-hover text-muted border border-transparent hover:border-subtle'
            }`}
          >
            <input
              type="checkbox"
              checked={adminOnly}
              onChange={(e) => setAdminOnly(e.target.checked)}
              className="sr-only"
            />
            <FiShield className="w-4 h-4" />
            Somente Administradores
          </label>
          {!adminOnly && functions.map(fn => (
            <label
              key={fn.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-sm ${
                selectedFunctionIds.includes(fn.id)
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-surface-hover text-muted border border-transparent hover:border-subtle'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedFunctionIds.includes(fn.id)}
                onChange={() => {
                  setSelectedFunctionIds(prev =>
                    prev.includes(fn.id)
                      ? prev.filter(id => id !== fn.id)
                      : [...prev, fn.id]
                  )
                }}
                className="sr-only"
              />
              <FiBriefcase className="w-4 h-4" style={{ color: fn.color }} />
              {fn.name}
            </label>
          ))}
        </div>

        {adminOnly && (
          <div className="mt-4 p-3 bg-red-500/10 rounded-lg">
            <p className="text-sm text-red-400">
              Este checklist sera visivel apenas para administradores, independente de loja ou setor.
            </p>
          </div>
        )}

        {!adminOnly && selectedFunctionIds.length > 0 && (
          <div className="mt-4 p-3 bg-info/10 rounded-lg">
            <p className="text-sm text-info">
              Restrito a {selectedFunctionIds.length} funcao{selectedFunctionIds.length > 1 ? 'es' : ''}
            </p>
          </div>
        )}
      </Modal>

      {/* Config Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="Configurações do Template" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Descrição</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="input min-h-[60px]" placeholder="Descrição do template (opcional)" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Horario inicio</label>
              <input type="time" value={allowedStartTime} onChange={e => setAllowedStartTime(e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">Horario fim</label>
              <input type="time" value={allowedEndTime} onChange={e => setAllowedEndTime(e.target.value)} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Prazo justificativa (horas)</label>
            <input type="number" min={1} max={365} value={justificationDeadlineHours}
              onChange={e => setJustificationDeadlineHours(e.target.value)} className="input w-32" placeholder="Ex: 24" />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Exigir justificativas?</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!skipJustifications} onChange={() => setSkipJustifications(false)}
                  className="w-4 h-4 text-primary" />
                <span className={!skipJustifications ? 'text-success font-medium' : 'text-muted'}>Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={skipJustifications} onChange={() => setSkipJustifications(true)}
                  className="w-4 h-4 text-primary" />
                <span className={skipJustifications ? 'text-warning font-medium' : 'text-muted'}>Nao</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
