'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { Header, IconPicker, Select, PageContainer, Modal } from '@/components/ui'
import Link from 'next/link'
import {
  FiSave,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiSettings,
  FiClipboard,
  FiGrid,
  FiBriefcase,
  FiPlus,
  FiLayers,
  FiShield,
} from 'react-icons/fi'
import { RiDraggable } from 'react-icons/ri'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Store, FieldType, TemplateCategory, Sector, FunctionRow } from '@/types/database'
import { FieldConditionEditor, type ConditionConfig, type PresetOption } from '@/components/admin/FieldConditionEditor'

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

function SortableItem({ id, children, className }: { id: string; className?: string; children: (listeners: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative', zIndex: isDragging ? 50 : undefined }} className={className} {...attributes}>
      {children(listeners || {})}
    </div>
  )
}

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

  // Time settings
  const [allowedStartTime, setAllowedStartTime] = useState('')
  const [allowedEndTime, setAllowedEndTime] = useState('')
  const [justificationDeadlineHours, setJustificationDeadlineHours] = useState('')

  // Sections
  const [sections, setSections] = useState<SectionConfig[]>([])

  // Fields
  const [fields, setFields] = useState<FieldConfig[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [expandedSubSection, setExpandedSubSection] = useState<string | null>(null)
  const [fieldConditions, setFieldConditions] = useState<Record<string, ConditionConfig | null>>({})
  const [conditionFunctions, setConditionFunctions] = useState<{ id: number; name: string }[]>([])
  const [conditionPresets, setConditionPresets] = useState<PresetOption[]>([])

  // Visibility - now includes sector_id
  const [visibility, setVisibility] = useState<VisibilityConfig[]>([])
  const [showSectorModal, setShowSectorModal] = useState(false)
  const [showFunctionModal, setShowFunctionModal] = useState(false)
  const { refreshKey } = useRealtimeRefresh(['template_fields'])
  const [reloadTrigger, setReloadTrigger] = useState(0)

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
    setExpandedSubSection(newSub.id)
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSections(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id)
      const newIdx = prev.findIndex(s => s.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      return arrayMove(prev, oldIdx, newIdx).map((s, i) => ({ ...s, sort_order: i + 1 }))
    })
  }

  const handleFieldDragEnd = (sectionId: string | null) => (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setFields(prev => {
      const group = prev.filter(f => f.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order)
      const oldIdx = group.findIndex(f => f.id === active.id)
      const newIdx = group.findIndex(f => f.id === over.id)
      if (oldIdx === -1 || newIdx === -1) return prev
      const reordered = arrayMove(group, oldIdx, newIdx)
      const sortMap = new Map(reordered.map((f, i) => [f.id, i + 1]))
      return prev.map(f => sortMap.has(f.id) ? { ...f, sort_order: sortMap.get(f.id)! } : f)
    })
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const getFieldTypeLabel = (type: FieldType) => {
    return fieldTypes.find(f => f.value === type)?.label || type
  }

  const getFieldTypeIcon = (type: FieldType) => {
    return fieldTypes.find(f => f.value === type)?.icon || '?'
  }

  // ─── Renderizador de campo reutilizavel ─────────────────────────────────────
  /** Renderiza um campo (SortableItem) com cabeçalho, condicoes e painel de edicao.
   *  Usado tanto em etapas com campos diretos quanto em sub-etapas. */
  const renderFieldItem = (field: FieldConfig) => (
    <SortableItem key={field.id} id={field.id} className={`border rounded-xl transition-colors ${editingField === field.id ? 'border-primary bg-surface-hover' : 'border-subtle bg-surface'}`}>
    {(fieldListeners) => (<>
      <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3">
        <div {...fieldListeners} className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none">
          <RiDraggable className="w-4 h-4" />
        </div>
        <IconPicker value={getFieldIcon(field)} onChange={(icon) => setFieldIcon(field.id, icon)} fallback={getFieldTypeIcon(field.field_type)} />
        <div className="flex-1 min-w-0">
          <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="Nome do campo" className="w-full bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-xs sm:text-sm" />
          <p className="text-[10px] sm:text-xs text-muted">{getFieldTypeLabel(field.field_type)}</p>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-secondary" title="Obrigatorio">
            <input type="checkbox" checked={field.is_required} onChange={(e) => updateField(field.id, { is_required: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Obrig.</span><span className="sm:hidden">*</span>
          </label>
          <button type="button" onClick={() => setEditingField(editingField === field.id ? null : field.id)} className={`p-1 sm:p-1.5 rounded-lg transition-colors ${editingField === field.id ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-surface-hover'}`}><FiSettings className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
          <button type="button" onClick={() => removeField(field.id)} className="p-1 sm:p-1.5 text-error hover:bg-error/20 rounded-lg transition-colors"><FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
        </div>
      </div>
      <FieldConditionEditor
        fieldType={field.field_type}
        fieldName={field.name}
        dropdownOptions={field.field_type === 'dropdown' ? getOptionsItems(field.options) : undefined}
        checkboxOptions={field.field_type === 'checkbox_multiple' ? getOptionsItems(field.options) : undefined}
        condition={fieldConditions[field.id] || null}
        onChange={(cond) => setFieldConditions(prev => ({ ...prev, [field.id]: cond }))}
        functions={conditionFunctions}
        presets={conditionPresets}
        onSaveAsPreset={handleSaveAsPreset}
      />
      {editingField === field.id && (
        <div className="px-2 pb-2 sm:px-3 sm:pb-3 pt-2 border-t border-subtle space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1">Tipo do campo</label>
            <Select value={field.field_type} onChange={(v) => changeFieldType(field.id, v as FieldType)} className="text-sm" options={fieldTypes.map(ft => ({ value: ft.value, label: `${ft.icon} ${ft.label}` }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Placeholder</label>
              <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="input text-sm" placeholder="Texto de exemplo..." />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Texto de ajuda</label>
              <input type="text" value={field.help_text} onChange={(e) => updateField(field.id, { help_text: e.target.value })} className="input text-sm" placeholder="Instrucoes para o usuario..." />
            </div>
          </div>
          {sections.length > 0 && (
            <div>
              <label className="block text-xs text-muted mb-1">Mover para etapa</label>
              <Select value={field.section_id || ''} onChange={(v) => updateField(field.id, { section_id: v || null })} className="text-sm" placeholder="Sem etapa (geral)" options={sections.filter(s => s.parent_id || getSubSections(s.id).length === 0).map(s => ({ value: String(s.id), label: s.parent_id ? `${parentSections.find(p => p.id === s.parent_id)?.name || ''} > ${s.name || '(sem nome)'}` : s.name || '(sem nome)' }))} />
            </div>
          )}
          {field.field_type === 'number' && (
            <div>
              <label className="block text-xs text-muted mb-1">Tipo de numero</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ value: 'monetario', label: 'Monetario (R$)' }, { value: 'quantidade', label: 'Quantidade (un)' }, { value: 'decimal', label: 'Decimal' }, { value: 'porcentagem', label: 'Porcentagem (%)' }].map(st => (
                  <button key={st.value} type="button" onClick={() => updateField(field.id, { options: { numberSubtype: st.value, ...(getFieldIcon(field) ? { icon: getFieldIcon(field) } : {}) } })} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${(field.options as { numberSubtype?: string } | null)?.numberSubtype === st.value ? 'bg-primary/15 border-primary text-primary' : 'bg-surface border-subtle text-muted hover:border-primary/40'}`}>{st.label}</button>
                ))}
              </div>
            </div>
          )}
          {(field.field_type === 'dropdown' || field.field_type === 'checkbox_multiple') && (
            <div>
              <label className="block text-xs text-muted mb-2">Opcoes</label>
              <div className="space-y-2">
                {getOptionsItems(field.options).map((opt: string, optIdx: number) => (
                  <div key={optIdx} className="flex items-center gap-2">
                    <span className="text-muted cursor-grab text-sm select-none">☰</span>
                    <input type="text" value={opt} onChange={(e) => { const newOpts = [...getOptionsItems(field.options)]; newOpts[optIdx] = e.target.value; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} placeholder={`Opcao ${optIdx + 1}`} className="input text-sm flex-1" />
                    <button type="button" onClick={() => { const newOpts = getOptionsItems(field.options).filter((_: string, i: number) => i !== optIdx); updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="p-1 text-error hover:bg-error/20 rounded transition-colors shrink-0"><FiTrash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { const newOpts = [...getOptionsItems(field.options), '']; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="mt-2 text-xs text-primary hover:text-primary/80 font-medium py-1.5 px-3 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">+ Adicionar opcao</button>
            </div>
          )}
          {field.field_type === 'yes_no' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                <input type="checkbox" checked={(field.options as { allowPhoto?: boolean } | null)?.allowPhoto || false} onChange={(e) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), allowPhoto: e.target.checked, photoRequired: false } })} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                Permitir foto
              </label>
              {(field.options as { allowPhoto?: boolean } | null)?.allowPhoto && (
                <Select value={(field.options as { photoRequired?: boolean } | null)?.photoRequired ? 'required' : 'optional'} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), photoRequired: v === 'required' } })} className="text-sm" options={[{ value: 'optional', label: 'Foto opcional' }, { value: 'required', label: 'Foto obrigatoria' }]} />
              )}
              <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
                <p className="text-xs font-medium text-emerald-500">Quando resposta for &quot;Sim&quot;:</p>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onYes.textFieldLabel; delete onYes.textFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>
                {!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onYes.photoFieldLabel; delete onYes.photoFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>
                {!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}
              </div>
              <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
                <p className="text-xs font-medium text-red-400">Quando resposta for &quot;Nao&quot;:</p>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNo.textFieldLabel; delete onNo.textFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>
                {!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNo.photoFieldLabel; delete onNo.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>
                {!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.allowUserActionPlan === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), allowUserActionPlan: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Permitir preenchedor escolher responsavel</label>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                <p className="text-xs font-medium text-amber-500">Quando resposta for &quot;N/A&quot;:</p>
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNa ? ((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa: Record<string, unknown> = { ...((opts.onNa as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNa.textFieldLabel; delete onNa.textFieldRequired }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>
                {!!(field.options as Record<string, unknown>)?.onNa && !!((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNa } }) }} placeholder="Label do campo (ex: Motivo do N/A)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNa as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}
                <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNa ? ((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa: Record<string, unknown> = { ...((opts.onNa as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNa.photoFieldLabel; delete onNa.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>
                {!!(field.options as Record<string, unknown>)?.onNa && !!((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNa } }) }} placeholder="Label da foto (ex: Foto de referencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNa as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}
              </div>
            </div>
          )}
          {!['dropdown', 'checkbox_multiple'].includes(field.field_type) && (<div><label className="block text-xs text-muted mb-1">Validacao cruzada</label><Select value={(field.options as { validationRole?: string } | null)?.validationRole || ''} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), validationRole: v || null } })} className="text-sm" placeholder="Nenhum" options={[{ value: 'nota', label: 'Numero da nota' }, { value: 'valor', label: 'Valor' }]} /></div>)}
        </div>
      )}
    </>)}
    </SortableItem>
  )

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Novo Checklist"
        icon={FiClipboard}
        backHref={APP_CONFIG.routes.adminTemplates}
      />

      {/* Main Content */}
      <PageContainer>
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-main mb-4">Informacoes do Checklist</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-secondary mb-2">
                  Nome do Checklist *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="input"
                  placeholder="Ex: Recebimento - Estoquista"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-secondary mb-2">
                  Descricao
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="Descricao breve do checklist..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Categoria
                </label>
                <Select
                  value={category}
                  onChange={(v) => setCategory(v as TemplateCategory)}
                  options={[
                    { value: 'recebimento', label: 'Recebimento' },
                    { value: 'limpeza',     label: 'Limpeza' },
                    { value: 'abertura',    label: 'Abertura' },
                    { value: 'fechamento',  label: 'Fechamento' },
                    { value: 'outros',      label: 'Outros' },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-subtle">
              <button type="button" onClick={() => setShowSectorModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle bg-surface-hover hover:border-primary/40 transition-all text-sm text-secondary hover:text-primary">
                <FiGrid className="w-4 h-4" />
                Visibilidade por Setor
                {visibility.length > 0 && (
                  <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">{visibility.length}</span>
                )}
              </button>
              <button type="button" onClick={() => setShowFunctionModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle bg-surface-hover hover:border-primary/40 transition-all text-sm text-secondary hover:text-primary">
                <FiBriefcase className="w-4 h-4" />
                Restringir por Funcao
                {adminOnly && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Admin</span>
                )}
                {!adminOnly && selectedFunctionIds.length > 0 && (
                  <span className="text-xs bg-info/20 text-info px-2 py-0.5 rounded-full">{selectedFunctionIds.length}</span>
                )}
              </button>
            </div>
          </div>

          {/* Configuracoes de Tempo */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-main mb-1">Configuracoes de Tempo</h2>
            <p className="text-sm text-muted mb-4">Deixe vazio para sem restricao</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Horario inicio
                </label>
                <input
                  type="time"
                  value={allowedStartTime}
                  onChange={(e) => setAllowedStartTime(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Horario fim
                </label>
                <input
                  type="time"
                  value={allowedEndTime}
                  onChange={(e) => setAllowedEndTime(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Prazo justificativas (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  value={justificationDeadlineHours}
                  onChange={(e) => setJustificationDeadlineHours(e.target.value)}
                  className="input"
                  placeholder="Ex: 48"
                />
              </div>
            </div>
          </div>

          {/* Etapas e Campos */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-main flex items-center gap-2">
                <FiLayers className="w-5 h-5 text-primary" />
                Etapas e Campos
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">{fields.length} campos</span>
                <button
                  type="button"
                  onClick={addSection}
                  className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <FiPlus className="w-4 h-4" />
                  Adicionar Etapa
                </button>
              </div>
            </div>
            <p className="text-sm text-muted mb-4">
              Divida o checklist em etapas para preenchimento em momentos diferentes do dia.
              Se nenhuma etapa for criada, o checklist sera preenchido de uma vez.
            </p>

            {sections.length > 0 ? (
              <div className="space-y-4">
                {/* Section accordions — only parent sections at top level */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                <SortableContext items={parentSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {parentSections.map((section, idx) => {
                  const subSections = getSubSections(section.id)
                  const hasSubSections = subSections.length > 0
                  // If has sub-sections, count all fields in sub-sections; otherwise fields directly in this section
                  const sectionFields = hasSubSections
                    ? fields.filter(f => subSections.some(sub => sub.id === f.section_id)).sort((a, b) => a.sort_order - b.sort_order)
                    : fields.filter(f => f.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order)
                  const isExpanded = expandedSection === section.id

                  return (
                    <SortableItem key={section.id} id={section.id} className="border border-subtle rounded-xl overflow-hidden">
                    {(dragListeners) => (<>
                      {/* Section header */}
                      <div
                        className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 cursor-pointer transition-colors ${
                          isExpanded ? 'bg-primary/10 border-b border-subtle' : 'bg-surface hover:bg-surface-hover'
                        }`}
                        onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      >
                        <div {...dragListeners} onClick={e => e.stopPropagation()} className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none">
                          <RiDraggable className="w-5 h-5" />
                        </div>
                        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{idx + 1}</span>
                        <input
                          type="text"
                          value={section.name}
                          onChange={(e) => updateSection(section.id, { name: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          placeholder="Nome da etapa"
                          className="flex-1 min-w-0 bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-sm sm:text-base"
                        />
                        <span className="text-xs text-muted whitespace-nowrap hidden sm:inline">
                          {hasSubSections ? `${subSections.length} sub-etapas` : `${sectionFields.length} campos`}
                        </span>
                        {isExpanded ? <FiChevronUp className="w-4 h-4 text-primary shrink-0" /> : <FiChevronDown className="w-4 h-4 text-muted shrink-0" />}
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeSection(section.id) }} className="p-1.5 sm:p-2 text-error hover:bg-error/20 rounded-lg transition-colors shrink-0">
                          <FiTrash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>

                      {/* Section content */}
                      {isExpanded && (
                        <div className="p-4 space-y-3">
                          {/* Add sub-etapa button */}
                          <button type="button" onClick={() => addSubSection(section.id)} className="btn-secondary flex items-center gap-2 px-3 py-2 text-sm w-full justify-center">
                            <FiPlus className="w-4 h-4" />
                            Adicionar Sub-etapa
                          </button>

                          {hasSubSections ? (
                            /* SUB-ETAPAS MODE: show nested sub-sections */
                            <div className="space-y-3">
                              {subSections.map((sub, subIdx) => {
                                const subFields = fields.filter(f => f.section_id === sub.id).sort((a, b) => a.sort_order - b.sort_order)
                                const isSubExpanded = expandedSubSection === sub.id
                                return (
                                  <div key={sub.id} className="border border-subtle rounded-lg overflow-hidden ml-4">
                                    <div
                                      className={`flex items-center gap-2 p-2 sm:p-3 cursor-pointer transition-colors ${isSubExpanded ? 'bg-secondary/10 border-b border-subtle' : 'bg-surface hover:bg-surface-hover'}`}
                                      onClick={() => setExpandedSubSection(isSubExpanded ? null : sub.id)}
                                    >
                                      <span className="w-5 h-5 rounded bg-secondary/10 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0">{subIdx + 1}</span>
                                      <input type="text" value={sub.name} onChange={(e) => updateSection(sub.id, { name: e.target.value })} onClick={e => e.stopPropagation()} placeholder="Nome da sub-etapa" className="flex-1 min-w-0 bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-xs sm:text-sm" />
                                      <span className="text-xs text-muted whitespace-nowrap hidden sm:inline">{subFields.length} campos</span>
                                      {isSubExpanded ? <FiChevronUp className="w-3.5 h-3.5 text-secondary shrink-0" /> : <FiChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />}
                                      <button type="button" onClick={(e) => { e.stopPropagation(); removeSection(sub.id) }} className="p-1 text-error hover:bg-error/20 rounded-lg transition-colors shrink-0"><FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                                    </div>
                                    {isSubExpanded && (
                                      <div className="p-3 space-y-3">
                                        <div className="flex flex-wrap gap-2 p-2 bg-surface-hover rounded-lg border border-subtle">
                                          <p className="w-full text-xs text-muted mb-1">Adicionar campo nesta sub-etapa:</p>
                                          {fieldTypes.map(type => (
                                            <button key={type.value} type="button" onClick={() => addField(type.value, sub.id)} className="btn-secondary flex items-center gap-1 px-2 py-1.5 text-xs">
                                              <span>{type.icon}</span>
                                              <span>{type.label}</span>
                                            </button>
                                          ))}
                                        </div>
                                        {subFields.length === 0 ? (
                                          <p className="text-center text-muted text-sm py-3">Nenhum campo nesta sub-etapa</p>
                                        ) : (
                                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd(sub.id)}>
                                          <SortableContext items={subFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                                          {subFields.map((field) => renderFieldItem(field))}
                                          </SortableContext>
                                          </DndContext>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            /* FLAT MODE: fields directly in this etapa */
                            <>
                          <div className="flex flex-wrap gap-2 p-3 bg-surface-hover rounded-xl border border-subtle">
                            <p className="w-full text-xs text-muted mb-1">Adicionar campo nesta etapa:</p>
                            {fieldTypes.map(type => (
                              <button key={type.value} type="button" onClick={() => addField(type.value, section.id)} className="btn-secondary flex items-center gap-1 px-2 py-1.5 text-xs">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </button>
                            ))}
                          </div>

                          {sectionFields.length === 0 ? (
                            <p className="text-center text-muted text-sm py-4">Nenhum campo nesta etapa</p>
                          ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd(section.id)}>
                            <SortableContext items={sectionFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                            {sectionFields.map((field) => (
                              <SortableItem key={field.id} id={field.id} className={`border rounded-xl transition-colors ${editingField === field.id ? 'border-primary bg-surface-hover' : 'border-subtle bg-surface'}`}>
                              {(fieldListeners) => (<>
                                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3">
                                  <div {...fieldListeners} className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none">
                                    <RiDraggable className="w-4 h-4" />
                                  </div>
                                  <IconPicker value={getFieldIcon(field)} onChange={(icon) => setFieldIcon(field.id, icon)} fallback={getFieldTypeIcon(field.field_type)} />
                                  <div className="flex-1 min-w-0">
                                    <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="Nome do campo" className="w-full bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-xs sm:text-sm" />
                                    <p className="text-[10px] sm:text-xs text-muted">{getFieldTypeLabel(field.field_type)}</p>
                                  </div>
                                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                    <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-secondary" title="Obrigatorio">
                                      <input type="checkbox" checked={field.is_required} onChange={(e) => updateField(field.id, { is_required: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                      <span className="hidden sm:inline">Obrig.</span><span className="sm:hidden">*</span>
                                    </label>
                                    <button type="button" onClick={() => setEditingField(editingField === field.id ? null : field.id)} className={`p-1 sm:p-1.5 rounded-lg transition-colors ${editingField === field.id ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-surface-hover'}`}><FiSettings className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                                    <button type="button" onClick={() => removeField(field.id)} className="p-1 sm:p-1.5 text-error hover:bg-error/20 rounded-lg transition-colors"><FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                                  </div>
                                </div>
                                <FieldConditionEditor
                                  fieldType={field.field_type}
                                  fieldName={field.name}
                                  dropdownOptions={field.field_type === 'dropdown' ? getOptionsItems(field.options) : undefined}
                                  checkboxOptions={field.field_type === 'checkbox_multiple' ? getOptionsItems(field.options) : undefined}
                                  condition={fieldConditions[field.id] || null}
                                  onChange={(cond) => setFieldConditions(prev => ({ ...prev, [field.id]: cond }))}
                                  functions={conditionFunctions}
                                  presets={conditionPresets}
                                  onSaveAsPreset={handleSaveAsPreset}
                                />
                                {editingField === field.id && (
                                  <div className="px-2 pb-2 sm:px-3 sm:pb-3 pt-2 border-t border-subtle space-y-3">
                                    <div>
                                      <label className="block text-xs text-muted mb-1">Tipo do campo</label>
                                      <Select value={field.field_type} onChange={(v) => changeFieldType(field.id, v as FieldType)} className="text-sm" options={fieldTypes.map(ft => ({ value: ft.value, label: `${ft.icon} ${ft.label}` }))} />
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs text-muted mb-1">Placeholder</label>
                                        <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="input text-sm" placeholder="Texto de exemplo..." />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-muted mb-1">Texto de ajuda</label>
                                        <input type="text" value={field.help_text} onChange={(e) => updateField(field.id, { help_text: e.target.value })} className="input text-sm" placeholder="Instrucoes para o usuario..." />
                                      </div>
                                    </div>
                                    {sections.length > 0 && (
                                      <div>
                                        <label className="block text-xs text-muted mb-1">Mover para etapa</label>
                                        <Select value={field.section_id || ''} onChange={(v) => updateField(field.id, { section_id: v || null })} className="text-sm" placeholder="Sem etapa (geral)" options={sections.map(s => ({ value: String(s.id), label: s.name || '(sem nome)' }))} />
                                      </div>
                                    )}
                                    {field.field_type === 'number' && (
                                      <div>
                                        <label className="block text-xs text-muted mb-1">Tipo de numero</label>
                                        <div className="grid grid-cols-2 gap-2">
                                          {[{ value: 'monetario', label: 'Monetario (R$)' }, { value: 'quantidade', label: 'Quantidade (un)' }, { value: 'decimal', label: 'Decimal' }, { value: 'porcentagem', label: 'Porcentagem (%)' }].map(st => (
                                            <button key={st.value} type="button" onClick={() => updateField(field.id, { options: { numberSubtype: st.value, ...(getFieldIcon(field) ? { icon: getFieldIcon(field) } : {}) } })} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${(field.options as { numberSubtype?: string } | null)?.numberSubtype === st.value ? 'bg-primary/15 border-primary text-primary' : 'bg-surface border-subtle text-muted hover:border-primary/40'}`}>{st.label}</button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {(field.field_type === 'dropdown' || field.field_type === 'checkbox_multiple') && (
                                      <div>
                                        <label className="block text-xs text-muted mb-2">Opcoes</label>
                                        <div className="space-y-2">
                                          {getOptionsItems(field.options).map((opt: string, optIdx: number) => (
                                            <div key={optIdx} className="flex items-center gap-2">
                                              <span className="text-muted cursor-grab text-sm select-none">☰</span>
                                              <input type="text" value={opt} onChange={(e) => { const newOpts = [...getOptionsItems(field.options)]; newOpts[optIdx] = e.target.value; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} placeholder={`Opcao ${optIdx + 1}`} className="input text-sm flex-1" />
                                              <button type="button" onClick={() => { const newOpts = getOptionsItems(field.options).filter((_: string, i: number) => i !== optIdx); updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="p-1 text-error hover:bg-error/20 rounded transition-colors shrink-0"><FiTrash2 className="w-3 h-3" /></button>
                                            </div>
                                          ))}
                                        </div>
                                        <button type="button" onClick={() => { const newOpts = [...getOptionsItems(field.options), '']; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="mt-2 text-xs text-primary hover:text-primary/80 font-medium py-1.5 px-3 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">+ Adicionar opcao</button>
                                      </div>
                                    )}
                                    {field.field_type === 'yes_no' && (
                                      <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                          <input type="checkbox" checked={(field.options as { allowPhoto?: boolean } | null)?.allowPhoto || false} onChange={(e) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), allowPhoto: e.target.checked, photoRequired: false } })} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                          Permitir foto
                                        </label>
                                        {(field.options as { allowPhoto?: boolean } | null)?.allowPhoto && (
                                          <Select value={(field.options as { photoRequired?: boolean } | null)?.photoRequired ? 'required' : 'optional'} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), photoRequired: v === 'required' } })} className="text-sm" options={[{ value: 'optional', label: 'Foto opcional' }, { value: 'required', label: 'Foto obrigatoria' }]} />
                                        )}
                                        {/* Conditional fields config for Sim */}
                                        <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
                                          <p className="text-xs font-medium text-emerald-500">Quando resposta for &quot;Sim&quot;:</p>
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onYes.textFieldLabel; delete onYes.textFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir texto explicativo
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Texto obrigatorio
                                              </label>
                                            </div>
                                          )}
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onYes.photoFieldLabel; delete onYes.photoFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir foto
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Foto obrigatoria
                                              </label>
                                            </div>
                                          )}
                                        </div>
                                        {/* Conditional fields config for Nao */}
                                        <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
                                          <p className="text-xs font-medium text-red-400">Quando resposta for &quot;Nao&quot;:</p>
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNo.textFieldLabel; delete onNo.textFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir texto explicativo
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Texto obrigatorio
                                              </label>
                                            </div>
                                          )}
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNo.photoFieldLabel; delete onNo.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir foto
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Foto obrigatoria
                                              </label>
                                            </div>
                                          )}
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.allowUserActionPlan === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), allowUserActionPlan: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Permitir preenchedor escolher responsavel</label>
                                        </div>
                                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                                          <p className="text-xs font-medium text-amber-500">Quando resposta for &quot;N/A&quot;:</p>
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNa ? ((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa: Record<string, unknown> = { ...((opts.onNa as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNa.textFieldLabel; delete onNa.textFieldRequired }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir texto explicativo
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onNa && !!((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showTextField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNa } }) }} placeholder="Label do campo (ex: Motivo do N/A)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNa as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Texto obrigatorio
                                              </label>
                                            </div>
                                          )}
                                          <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                                            <input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNa ? ((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa: Record<string, unknown> = { ...((opts.onNa as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNa.photoFieldLabel; delete onNa.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />
                                            Exigir foto
                                          </label>
                                          {!!(field.options as Record<string, unknown>)?.onNa && !!((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.showPhotoField && (
                                            <div className="ml-6 space-y-2">
                                              <input type="text" value={((field.options as Record<string, unknown>).onNa as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNa } }) }} placeholder="Label da foto (ex: Foto de referencia)" className="input text-sm" />
                                              <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                                                <input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNa as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNa = { ...((opts.onNa as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNa } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                                                Foto obrigatoria
                                              </label>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {!['dropdown', 'checkbox_multiple'].includes(field.field_type) && (<div><label className="block text-xs text-muted mb-1">Validacao cruzada</label><Select value={(field.options as { validationRole?: string } | null)?.validationRole || ''} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), validationRole: v || null } })} className="text-sm" placeholder="Nenhum" options={[{ value: 'nota', label: 'Numero da nota' }, { value: 'valor', label: 'Valor' }]} /></div>)}
                                  </div>
                                )}
                              </>)}
                              </SortableItem>
                            ))}
                            </SortableContext>
                            </DndContext>
                          )}
                            </>
                          )}
                        </div>
                      )}
                    </>)}
                    </SortableItem>
                  )
                })}
                </SortableContext>
                </DndContext>

                {/* Campos Gerais (without section) */}
                <div className="border border-dashed border-subtle rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-medium text-muted">Campos Gerais (sem etapa)</h3>
                  <div className="flex flex-wrap gap-2 p-3 bg-surface-hover rounded-xl border border-subtle">
                    <p className="w-full text-xs text-muted mb-1">Adicionar campo geral:</p>
                    {fieldTypes.map(type => (
                      <button key={type.value} type="button" onClick={() => addField(type.value)} className="btn-secondary flex items-center gap-1 px-2 py-1.5 text-xs">
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                  {(() => {
                    const generalFields = fields.filter(f => !f.section_id).sort((a, b) => a.sort_order - b.sort_order)
                    return generalFields.length === 0 ? (
                      <p className="text-center text-muted text-sm py-2">Nenhum campo geral</p>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd(null)}>
                      <SortableContext items={generalFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                      {generalFields.map((field) => (
                        <SortableItem key={field.id} id={field.id} className={`border rounded-xl transition-colors ${editingField === field.id ? 'border-primary bg-surface-hover' : 'border-subtle bg-surface'}`}>
                        {(fieldListeners) => (<>
                          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3">
                            <div {...fieldListeners} className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none">
                              <RiDraggable className="w-4 h-4" />
                            </div>
                            <IconPicker value={getFieldIcon(field)} onChange={(icon) => setFieldIcon(field.id, icon)} fallback={getFieldTypeIcon(field.field_type)} />
                            <div className="flex-1 min-w-0">
                              <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="Nome do campo" className="w-full bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-xs sm:text-sm" />
                              <p className="text-[10px] sm:text-xs text-muted">{getFieldTypeLabel(field.field_type)}</p>
                            </div>
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <label className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-secondary" title="Obrigatorio">
                                <input type="checkbox" checked={field.is_required} onChange={(e) => updateField(field.id, { is_required: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span className="hidden sm:inline">Obrig.</span><span className="sm:hidden">*</span>
                              </label>
                              <button type="button" onClick={() => setEditingField(editingField === field.id ? null : field.id)} className={`p-1 sm:p-1.5 rounded-lg transition-colors ${editingField === field.id ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-surface-hover'}`}><FiSettings className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                              <button type="button" onClick={() => removeField(field.id)} className="p-1 sm:p-1.5 text-error hover:bg-error/20 rounded-lg transition-colors"><FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /></button>
                            </div>
                          </div>
                          <FieldConditionEditor
                            fieldType={field.field_type}
                            fieldName={field.name}
                            dropdownOptions={field.field_type === 'dropdown' ? getOptionsItems(field.options) : undefined}
                            checkboxOptions={field.field_type === 'checkbox_multiple' ? getOptionsItems(field.options) : undefined}
                            condition={fieldConditions[field.id] || null}
                            onChange={(cond) => setFieldConditions(prev => ({ ...prev, [field.id]: cond }))}
                            functions={conditionFunctions}
                            presets={conditionPresets}
                            onSaveAsPreset={handleSaveAsPreset}
                          />
                          {editingField === field.id && (
                            <div className="px-2 pb-2 sm:px-3 sm:pb-3 pt-2 border-t border-subtle space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-muted mb-1">Placeholder</label>
                                  <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="input text-sm" placeholder="Texto de exemplo..." />
                                </div>
                                <div>
                                  <label className="block text-xs text-muted mb-1">Texto de ajuda</label>
                                  <input type="text" value={field.help_text} onChange={(e) => updateField(field.id, { help_text: e.target.value })} className="input text-sm" placeholder="Instrucoes para o usuario..." />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-muted mb-1">Mover para etapa</label>
                                <Select value={field.section_id || ''} onChange={(v) => updateField(field.id, { section_id: v || null })} className="text-sm" placeholder="Sem etapa (geral)" options={sections.map(s => ({ value: String(s.id), label: s.name || '(sem nome)' }))} />
                              </div>
                              {field.field_type === 'number' && (
                                <div>
                                  <label className="block text-xs text-muted mb-1">Tipo de numero</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {[{ value: 'monetario', label: 'Monetario (R$)' }, { value: 'quantidade', label: 'Quantidade (un)' }, { value: 'decimal', label: 'Decimal' }, { value: 'porcentagem', label: 'Porcentagem (%)' }].map(st => (
                                      <button key={st.value} type="button" onClick={() => updateField(field.id, { options: { numberSubtype: st.value, ...(getFieldIcon(field) ? { icon: getFieldIcon(field) } : {}) } })} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${(field.options as { numberSubtype?: string } | null)?.numberSubtype === st.value ? 'bg-primary/15 border-primary text-primary' : 'bg-surface border-subtle text-muted hover:border-primary/40'}`}>{st.label}</button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {(field.field_type === 'dropdown' || field.field_type === 'checkbox_multiple') && (
                                <div>
                                  <label className="block text-xs text-muted mb-2">Opcoes</label>
                                  <div className="space-y-2">
                                    {getOptionsItems(field.options).map((opt: string, optIdx: number) => (
                                      <div key={optIdx} className="flex items-center gap-2">
                                        <span className="text-muted cursor-grab text-sm select-none">☰</span>
                                        <input type="text" value={opt} onChange={(e) => { const newOpts = [...getOptionsItems(field.options)]; newOpts[optIdx] = e.target.value; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} placeholder={`Opcao ${optIdx + 1}`} className="input text-sm flex-1" />
                                        <button type="button" onClick={() => { const newOpts = getOptionsItems(field.options).filter((_: string, i: number) => i !== optIdx); updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="p-1 text-error hover:bg-error/20 rounded transition-colors shrink-0"><FiTrash2 className="w-3 h-3" /></button>
                                      </div>
                                    ))}
                                  </div>
                                  <button type="button" onClick={() => { const newOpts = [...getOptionsItems(field.options), '']; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="mt-2 text-xs text-primary hover:text-primary/80 font-medium py-1.5 px-3 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">+ Adicionar opcao</button>
                                </div>
                              )}
                              {field.field_type === 'yes_no' && (<div className="space-y-2"><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as { allowPhoto?: boolean } | null)?.allowPhoto || false} onChange={(e) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), allowPhoto: e.target.checked, photoRequired: false } })} className="rounded border-default bg-surface text-primary focus:ring-primary" />Permitir foto</label>{(field.options as { allowPhoto?: boolean } | null)?.allowPhoto && (<Select value={(field.options as { photoRequired?: boolean } | null)?.photoRequired ? 'required' : 'optional'} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), photoRequired: v === 'required' } })} className="text-sm" options={[{ value: 'optional', label: 'Foto opcional' }, { value: 'required', label: 'Foto obrigatoria' }]} />)}<div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2"><p className="text-xs font-medium text-emerald-500">Quando resposta for &quot;Sim&quot;:</p><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onYes.textFieldLabel; delete onYes.textFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>{!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}<label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onYes.photoFieldLabel; delete onYes.photoFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>{!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}</div><div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2"><p className="text-xs font-medium text-red-400">Quando resposta for &quot;Nao&quot;:</p><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNo.textFieldLabel; delete onNo.textFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>{!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}<label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNo.photoFieldLabel; delete onNo.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>{!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}</div></div>)}
                              {!['dropdown', 'checkbox_multiple'].includes(field.field_type) && (<div><label className="block text-xs text-muted mb-1">Validacao cruzada</label><Select value={(field.options as { validationRole?: string } | null)?.validationRole || ''} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), validationRole: v || null } })} className="text-sm" placeholder="Nenhum" options={[{ value: 'nota', label: 'Numero da nota' }, { value: 'valor', label: 'Valor' }]} /></div>)}
                            </div>
                          )}
                        </>)}
                        </SortableItem>
                      ))}
                      </SortableContext>
                      </DndContext>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <>
                {/* No sections: flat field list */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-6 p-2 sm:p-4 bg-surface-hover rounded-xl border border-subtle">
                  <p className="w-full text-xs sm:text-sm text-muted mb-1 sm:mb-2">Adicionar campo:</p>
                  {fieldTypes.map(type => (
                    <button key={type.value} type="button" onClick={() => addField(type.value)} className="btn-secondary flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
                      <span>{type.icon}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    <p>Nenhum campo adicionado</p>
                    <p className="text-sm mt-1">Clique nos botoes acima para adicionar campos</p>
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFieldDragEnd(null)}>
                  <SortableContext items={[...fields].sort((a, b) => a.sort_order - b.sort_order).map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {[...fields].sort((a, b) => a.sort_order - b.sort_order).map((field) => (
                      <SortableItem key={field.id} id={field.id} className={`border rounded-xl transition-colors ${editingField === field.id ? 'border-primary bg-surface-hover' : 'border-subtle bg-surface'}`}>
                      {(fieldListeners) => (<>
                        <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-4">
                          <div {...fieldListeners} className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none">
                            <RiDraggable className="w-5 h-5" />
                          </div>
                          <IconPicker value={getFieldIcon(field)} onChange={(icon) => setFieldIcon(field.id, icon)} fallback={getFieldTypeIcon(field.field_type)} />
                          <div className="flex-1 min-w-0">
                            <input type="text" value={field.name} onChange={(e) => updateField(field.id, { name: e.target.value })} placeholder="Nome do campo" className="w-full bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-sm sm:text-base" />
                            <p className="text-[10px] sm:text-xs text-muted">{getFieldTypeLabel(field.field_type)}</p>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <label className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm text-secondary" title="Obrigatorio">
                              <input type="checkbox" checked={field.is_required} onChange={(e) => updateField(field.id, { is_required: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="hidden sm:inline">Obrigatorio</span><span className="sm:hidden">*</span>
                            </label>
                            <button type="button" onClick={() => setEditingField(editingField === field.id ? null : field.id)} className={`p-1 sm:p-2 rounded-lg transition-colors ${editingField === field.id ? 'bg-primary/20 text-primary' : 'text-muted hover:bg-surface-hover'}`}><FiSettings className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                            <button type="button" onClick={() => removeField(field.id)} className="p-1 sm:p-2 text-error hover:bg-error/20 rounded-lg transition-colors"><FiTrash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                          </div>
                        </div>
                        {editingField === field.id && (
                          <div className="px-2 pb-2 sm:px-4 sm:pb-4 pt-2 border-t border-subtle space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <div>
                                <label className="block text-xs text-muted mb-1">Placeholder</label>
                                <input type="text" value={field.placeholder} onChange={(e) => updateField(field.id, { placeholder: e.target.value })} className="input text-sm" placeholder="Texto de exemplo..." />
                              </div>
                              <div>
                                <label className="block text-xs text-muted mb-1">Texto de ajuda</label>
                                <input type="text" value={field.help_text} onChange={(e) => updateField(field.id, { help_text: e.target.value })} className="input text-sm" placeholder="Instrucoes para o usuario..." />
                              </div>
                            </div>
                            {field.field_type === 'number' && (
                              <div>
                                <label className="block text-xs text-muted mb-1">Tipo de numero</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {[{ value: 'monetario', label: 'Monetario (R$)' }, { value: 'quantidade', label: 'Quantidade (un)' }, { value: 'decimal', label: 'Decimal' }, { value: 'porcentagem', label: 'Porcentagem (%)' }].map(st => (
                                    <button key={st.value} type="button" onClick={() => updateField(field.id, { options: { numberSubtype: st.value, ...(getFieldIcon(field) ? { icon: getFieldIcon(field) } : {}) } })} className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${(field.options as { numberSubtype?: string } | null)?.numberSubtype === st.value ? 'bg-primary/15 border-primary text-primary' : 'bg-surface border-subtle text-muted hover:border-primary/40'}`}>{st.label}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(field.field_type === 'dropdown' || field.field_type === 'checkbox_multiple') && (
                              <div>
                                <label className="block text-xs text-muted mb-2">Opcoes</label>
                                <div className="space-y-2">
                                  {getOptionsItems(field.options).map((opt: string, optIdx: number) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                      <span className="text-muted cursor-grab text-sm select-none">☰</span>
                                      <input type="text" value={opt} onChange={(e) => { const newOpts = [...getOptionsItems(field.options)]; newOpts[optIdx] = e.target.value; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} placeholder={`Opcao ${optIdx + 1}`} className="input text-sm flex-1" />
                                      <button type="button" onClick={() => { const newOpts = getOptionsItems(field.options).filter((_: string, i: number) => i !== optIdx); updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="p-1 text-error hover:bg-error/20 rounded transition-colors shrink-0"><FiTrash2 className="w-3 h-3" /></button>
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={() => { const newOpts = [...getOptionsItems(field.options), '']; updateField(field.id, { options: getFieldIcon(field) ? { items: newOpts, icon: getFieldIcon(field) } : newOpts }) }} className="mt-2 text-xs text-primary hover:text-primary/80 font-medium py-1.5 px-3 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">+ Adicionar opcao</button>
                              </div>
                            )}
                            {field.field_type === 'yes_no' && (<div className="space-y-2"><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as { allowPhoto?: boolean } | null)?.allowPhoto || false} onChange={(e) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), allowPhoto: e.target.checked, photoRequired: false } })} className="rounded border-default bg-surface text-primary focus:ring-primary" />Permitir foto</label>{(field.options as { allowPhoto?: boolean } | null)?.allowPhoto && (<Select value={(field.options as { photoRequired?: boolean } | null)?.photoRequired ? 'required' : 'optional'} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), photoRequired: v === 'required' } })} className="text-sm" options={[{ value: 'optional', label: 'Foto opcional' }, { value: 'required', label: 'Foto obrigatoria' }]} />)}<div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2"><p className="text-xs font-medium text-emerald-500">Quando resposta for &quot;Sim&quot;:</p><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onYes.textFieldLabel; delete onYes.textFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>{!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}<label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onYes ? ((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes: Record<string, unknown> = { ...((opts.onYes as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onYes.photoFieldLabel; delete onYes.photoFieldRequired }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>{!!(field.options as Record<string, unknown>)?.onYes && !!((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onYes as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onYes } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onYes as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onYes = { ...((opts.onYes as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onYes } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}</div><div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2"><p className="text-xs font-medium text-red-400">Quando resposta for &quot;Nao&quot;:</p><label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showTextField: e.target.checked }; if (!e.target.checked) { delete onNo.textFieldLabel; delete onNo.textFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir texto explicativo</label>{!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showTextField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.textFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.textFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), textFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Texto obrigatorio</label></div>)}<label className="flex items-center gap-2 text-sm text-secondary cursor-pointer"><input type="checkbox" checked={(field.options as Record<string, unknown>)?.onNo ? ((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField === true : false} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo: Record<string, unknown> = { ...((opts.onNo as Record<string, unknown>) || {}), showPhotoField: e.target.checked }; if (!e.target.checked) { delete onNo.photoFieldLabel; delete onNo.photoFieldRequired }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary" />Exigir foto</label>{!!(field.options as Record<string, unknown>)?.onNo && !!((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.showPhotoField && (<div className="ml-6 space-y-2"><input type="text" value={((field.options as Record<string, unknown>).onNo as Record<string, unknown>)?.photoFieldLabel as string || ''} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldLabel: e.target.value }; updateField(field.id, { options: { ...opts, onNo } }) }} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" /><label className="flex items-center gap-2 text-xs text-muted cursor-pointer"><input type="checkbox" checked={((field.options as Record<string, unknown>)?.onNo as Record<string, unknown>)?.photoFieldRequired === true} onChange={(e) => { const opts = { ...((field.options as Record<string, unknown>) || {})}; const onNo = { ...((opts.onNo as Record<string, unknown>) || {}), photoFieldRequired: e.target.checked }; updateField(field.id, { options: { ...opts, onNo } }) }} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />Foto obrigatoria</label></div>)}</div></div>)}
                            {!['dropdown', 'checkbox_multiple'].includes(field.field_type) && (<div><label className="block text-xs text-muted mb-1">Validacao cruzada</label><Select value={(field.options as { validationRole?: string } | null)?.validationRole || ''} onChange={(v) => updateField(field.id, { options: { ...((field.options as Record<string, unknown>) || {}), validationRole: v || null } })} className="text-sm" placeholder="Nenhum" options={[{ value: 'nota', label: 'Numero da nota' }, { value: 'valor', label: 'Valor' }]} /></div>)}
                            <FieldConditionEditor
                              fieldType={field.field_type}
                              fieldName={field.name}
                              dropdownOptions={field.field_type === 'dropdown' ? getOptionsItems(field.options) : undefined}
                              checkboxOptions={field.field_type === 'checkbox_multiple' ? getOptionsItems(field.options) : undefined}
                              condition={fieldConditions[field.id] || null}
                              onChange={(cond) => setFieldConditions(prev => ({ ...prev, [field.id]: cond }))}
                              functions={conditionFunctions}
                              presets={conditionPresets}
                              onSaveAsPreset={handleSaveAsPreset}
                            />
                          </div>
                        )}
                      </>)}
                      </SortableItem>
                    ))}
                  </div>
                  </SortableContext>
                  </DndContext>
                )}
              </>
            )}
          </div>

          {/* Modal: Visibilidade por Setor */}
          <Modal isOpen={showSectorModal} onClose={() => setShowSectorModal(false)} title="Visibilidade por Setor" size="lg">
            <p className="text-sm text-muted mb-4">
              Selecione em quais setores este checklist estara disponivel.
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
                    {/* Store Header */}
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

                    {/* Sectors */}
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

          {/* Modal: Restringir por Funcao */}
          <Modal isOpen={showFunctionModal} onClose={() => setShowFunctionModal(false)} title="Restringir por Funcao" size="md">
            <p className="text-sm text-muted mb-4">
              Se nenhuma funcao for selecionada, o checklist estara disponivel para todas as funcoes.
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

          {/* Error */}
          {error && (
            <div className="p-4 bg-error/10 rounded-xl border border-error/30">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href={APP_CONFIG.routes.adminTemplates}
              className="btn-ghost"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Criar Checklist
                </>
              )}
            </button>
          </div>
        </form>
      </PageContainer>
    </div>
  )
}
