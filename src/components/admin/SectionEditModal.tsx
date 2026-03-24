'use client'

import React, { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiSettings,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi'
import { RiDraggable } from 'react-icons/ri'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { FieldType } from '@/types/database'
import { Select } from '@/components/ui/Select'
import { IconPicker } from '@/components/ui/IconPicker'
import {
  FieldConditionEditor,
  type ConditionConfig,
  type PresetOption,
} from '@/components/admin/FieldConditionEditor'

// ─── Types ──────────────────────────────────────────────────────────────────

type FieldConfig = {
  id: string
  section_id: string | null
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

type SubSection = {
  id: string
  name: string
  sort_order: number
}

type Props = {
  isOpen: boolean
  onClose: () => void
  section: { id: string; name: string; description: string } | null
  subSections: SubSection[]
  fields: FieldConfig[]
  onSectionUpdate: (id: string, updates: Partial<{ name: string; description: string }>) => void
  onSubSectionAdd: (parentId: string) => void
  onSubSectionDelete: (id: string) => void
  onFieldAdd: (sectionId: string) => void
  onFieldUpdate: (fieldId: string, updates: Partial<FieldConfig>) => void
  onFieldDelete: (fieldId: string) => void
  onFieldReorder: (fields: FieldConfig[]) => void
  fieldConditions: Record<string, ConditionConfig | null>
  onConditionChange: (fieldId: string, condition: ConditionConfig | null) => void
  conditionFunctions: Array<{ id: number; name: string }>
  conditionPresets: PresetOption[]
  onSaveAsPreset: (data: {
    name: string
    severity: string
    deadlineDays: number
    defaultFunctionId: number | null
    descriptionTemplate: string
  }) => void
  editingField: string | null
  onEditField: (fieldId: string | null) => void
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: string }[] = [
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

// ─── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOptionsItems(options: any): string[] {
  if (Array.isArray(options)) return options
  if (options && typeof options === 'object' && 'items' in options) {
    return options.items as string[]
  }
  return []
}

function getFieldIcon(field: FieldConfig): string | null {
  if (field.options && typeof field.options === 'object' && !Array.isArray(field.options)) {
    return (field.options as Record<string, unknown>).icon as string | null || null
  }
  return null
}

function getFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPES.find((f) => f.value === type)?.label || type
}

function getFieldTypeIcon(type: FieldType): string {
  return FIELD_TYPES.find((f) => f.value === type)?.icon || '?'
}

// ─── Sortable field item ────────────────────────────────────────────────────

function SortableFieldItem({
  id,
  children,
  className,
}: {
  id: string
  className?: string
  children: (listeners: Record<string, unknown>) => React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : undefined,
      }}
      className={className}
      {...attributes}
    >
      {children(listeners || {})}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Modal de edição de seção de template para o painel admin.
 *
 * Funcionalidades:
 * - Renomear a seção e definir ícone via `IconPicker`
 * - Adicionar, renomear, reordenar (dnd-kit) e excluir subseções
 * - Listar e reordenar campos da seção com drag-and-drop
 * - Navegar para edição individual de campo via `onFieldEdit`
 *
 * Renderizado via `createPortal` no `document.body`.
 */
export function SectionEditModal({
  isOpen,
  onClose,
  section,
  subSections,
  fields,
  onSectionUpdate,
  onSubSectionAdd,
  onSubSectionDelete,
  onFieldAdd,
  onFieldUpdate,
  onFieldDelete,
  onFieldReorder,
  fieldConditions,
  onConditionChange,
  conditionFunctions,
  conditionPresets,
  onSaveAsPreset,
  editingField,
  onEditField,
}: Props) {
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({})
  const [showFieldTypePicker, setShowFieldTypePicker] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const toggleSub = (id: string) => {
    setExpandedSubs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle field icon change
  const handleSetFieldIcon = useCallback(
    (fieldId: string, iconName: string | null) => {
      const field = fields.find((f) => f.id === fieldId)
      if (!field) return

      if (Array.isArray(field.options)) {
        onFieldUpdate(fieldId, {
          options: iconName ? { items: field.options, icon: iconName } : field.options,
        })
      } else if (field.options && typeof field.options === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opts = { ...(field.options as any), icon: iconName }
        if (!iconName) delete opts.icon
        onFieldUpdate(fieldId, {
          options: Object.keys(opts).length === 0 ? null : opts,
        })
      } else {
        onFieldUpdate(fieldId, {
          options: iconName ? { icon: iconName } : field.options,
        })
      }
    },
    [fields, onFieldUpdate]
  )

  // Handle field type change
  const handleChangeFieldType = useCallback(
    (fieldId: string, newType: FieldType) => {
      const field = fields.find((f) => f.id === fieldId)
      if (!field) return
      const currentIcon = getFieldIcon(field)
      let defaultOptions: unknown =
        newType === 'dropdown' || newType === 'checkbox_multiple'
          ? []
          : newType === 'number'
            ? { numberSubtype: 'decimal' }
            : null
      if (currentIcon) {
        if (Array.isArray(defaultOptions)) {
          defaultOptions = { items: defaultOptions, icon: currentIcon }
        } else if (defaultOptions && typeof defaultOptions === 'object') {
          defaultOptions = { ...(defaultOptions as Record<string, unknown>), icon: currentIcon }
        } else {
          defaultOptions = { icon: currentIcon }
        }
      }
      onFieldUpdate(fieldId, { field_type: newType, options: defaultOptions })
    },
    [fields, onFieldUpdate]
  )

  // Handle field drag end
  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order)
    const oldIdx = sortedFields.findIndex((f) => f.id === active.id)
    const newIdx = sortedFields.findIndex((f) => f.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(sortedFields, oldIdx, newIdx).map((f, i) => ({
      ...f,
      sort_order: i + 1,
    }))
    onFieldReorder(reordered)
  }

  // Render a single field item
  const renderFieldItem = (field: FieldConfig) => (
    <SortableFieldItem
      key={field.id}
      id={field.id}
      className={`border rounded-xl transition-colors ${
        editingField === field.id
          ? 'border-primary bg-surface-hover'
          : 'border-subtle bg-surface'
      }`}
    >
      {(fieldListeners) => (
        <>
          {/* Field header row */}
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3">
            <div
              {...fieldListeners}
              className="cursor-grab active:cursor-grabbing p-1 text-muted hover:text-primary touch-none"
            >
              <RiDraggable className="w-4 h-4" />
            </div>

            <IconPicker
              value={getFieldIcon(field)}
              onChange={(icon) => handleSetFieldIcon(field.id, icon)}
              fallback={getFieldTypeIcon(field.field_type)}
            />

            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={field.name}
                onChange={(e) => onFieldUpdate(field.id, { name: e.target.value })}
                placeholder="Nome do campo"
                className="w-full bg-transparent border-none text-main placeholder:text-muted focus:outline-none font-medium text-xs sm:text-sm"
              />
              <p className="text-[10px] sm:text-xs text-muted">
                {getFieldTypeLabel(field.field_type)}
              </p>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <label
                className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs text-secondary"
                title="Obrigatorio"
              >
                <input
                  type="checkbox"
                  checked={field.is_required}
                  onChange={(e) => onFieldUpdate(field.id, { is_required: e.target.checked })}
                  className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 sm:w-3.5 sm:h-3.5"
                />
                <span className="hidden sm:inline">Obrig.</span>
                <span className="sm:hidden">*</span>
              </label>

              <button
                type="button"
                onClick={() => onEditField(editingField === field.id ? null : field.id)}
                className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                  editingField === field.id
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted hover:bg-surface-hover'
                }`}
              >
                <FiSettings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => onFieldDelete(field.id)}
                className="p-1 sm:p-1.5 text-error hover:bg-error/20 rounded-lg transition-colors"
              >
                <FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {/* Condition editor */}
          <FieldConditionEditor
            fieldType={field.field_type}
            fieldName={field.name}
            dropdownOptions={
              field.field_type === 'dropdown' ? getOptionsItems(field.options) : undefined
            }
            checkboxOptions={
              field.field_type === 'checkbox_multiple'
                ? getOptionsItems(field.options)
                : undefined
            }
            condition={fieldConditions[field.id] || null}
            onChange={(cond) => onConditionChange(field.id, cond)}
            functions={conditionFunctions}
            presets={conditionPresets}
            onSaveAsPreset={onSaveAsPreset}
          />

          {/* Expanded settings panel */}
          {editingField === field.id && (
            <div className="px-2 pb-2 sm:px-3 sm:pb-3 pt-2 border-t border-subtle space-y-3">
              {/* Field type selector */}
              <div>
                <label className="block text-xs text-muted mb-1">Tipo do campo</label>
                <Select
                  value={field.field_type}
                  onChange={(v) => handleChangeFieldType(field.id, v as FieldType)}
                  className="text-sm"
                  options={FIELD_TYPES.map((ft) => ({
                    value: ft.value,
                    label: `${ft.icon} ${ft.label}`,
                  }))}
                />
              </div>

              {/* Placeholder & help text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder}
                    onChange={(e) => onFieldUpdate(field.id, { placeholder: e.target.value })}
                    className="input text-sm"
                    placeholder="Texto de exemplo..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Texto de ajuda</label>
                  <input
                    type="text"
                    value={field.help_text}
                    onChange={(e) => onFieldUpdate(field.id, { help_text: e.target.value })}
                    className="input text-sm"
                    placeholder="Instrucoes para o usuario..."
                  />
                </div>
              </div>

              {/* Number subtype */}
              {field.field_type === 'number' && (
                <div>
                  <label className="block text-xs text-muted mb-1">Tipo de numero</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'monetario', label: 'Monetario (R$)' },
                      { value: 'quantidade', label: 'Quantidade (un)' },
                      { value: 'decimal', label: 'Decimal' },
                      { value: 'porcentagem', label: 'Porcentagem (%)' },
                    ].map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={() =>
                          onFieldUpdate(field.id, {
                            options: {
                              numberSubtype: st.value,
                              ...(getFieldIcon(field) ? { icon: getFieldIcon(field) } : {}),
                            },
                          })
                        }
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                          (field.options as { numberSubtype?: string } | null)?.numberSubtype ===
                          st.value
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'bg-surface border-subtle text-muted hover:border-primary/40'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dropdown / checkbox options */}
              {(field.field_type === 'dropdown' || field.field_type === 'checkbox_multiple') && (
                <div>
                  <label className="block text-xs text-muted mb-2">Opcoes</label>
                  <div className="space-y-2">
                    {getOptionsItems(field.options).map((opt: string, optIdx: number) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <span className="text-muted cursor-grab text-sm select-none">
                          &#9776;
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...getOptionsItems(field.options)]
                            newOpts[optIdx] = e.target.value
                            onFieldUpdate(field.id, {
                              options: getFieldIcon(field)
                                ? { items: newOpts, icon: getFieldIcon(field) }
                                : newOpts,
                            })
                          }}
                          placeholder={`Opcao ${optIdx + 1}`}
                          className="input text-sm flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = getOptionsItems(field.options).filter(
                              (_: string, i: number) => i !== optIdx
                            )
                            onFieldUpdate(field.id, {
                              options: getFieldIcon(field)
                                ? { items: newOpts, icon: getFieldIcon(field) }
                                : newOpts,
                            })
                          }}
                          className="p-1 text-error hover:bg-error/20 rounded transition-colors shrink-0"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newOpts = [...getOptionsItems(field.options), '']
                      onFieldUpdate(field.id, {
                        options: getFieldIcon(field)
                          ? { items: newOpts, icon: getFieldIcon(field) }
                          : newOpts,
                      })
                    }}
                    className="mt-2 text-xs text-primary hover:text-primary/80 font-medium py-1.5 px-3 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                  >
                    + Adicionar opcao
                  </button>
                </div>
              )}

              {/* Yes/No specific options */}
              {field.field_type === 'yes_no' && (() => {
                const opts = (field.options as Record<string, unknown>) || {}
                const updateOpts = (patch: Record<string, unknown>) => onFieldUpdate(field.id, { options: { ...opts, ...patch } })
                const getCondBlock = (key: 'onYes' | 'onNo' | 'onNa') => (opts[key] as Record<string, unknown>) || {}
                const setCondBlock = (key: 'onYes' | 'onNo' | 'onNa', patch: Record<string, unknown>) => {
                  const current = getCondBlock(key)
                  updateOpts({ [key]: { ...current, ...patch } })
                }
                const clearCondField = (key: 'onYes' | 'onNo' | 'onNa', ...fields: string[]) => {
                  const current = { ...getCondBlock(key) }
                  fields.forEach(f => delete current[f])
                  updateOpts({ [key]: current })
                }

                return (
                <div className="space-y-3">
                  {/* Foto principal */}
                  <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                    <input type="checkbox" checked={(opts.allowPhoto as boolean) || false}
                      onChange={(e) => updateOpts({ allowPhoto: e.target.checked, photoRequired: false })}
                      className="rounded border-default bg-surface text-primary focus:ring-primary" />
                    Permitir foto
                  </label>
                  {(opts.allowPhoto as boolean) && (
                    <Select value={(opts.photoRequired as boolean) ? 'required' : 'optional'}
                      onChange={(v) => updateOpts({ photoRequired: v === 'required' })}
                      className="text-sm"
                      options={[{ value: 'optional', label: 'Foto opcional' }, { value: 'required', label: 'Foto obrigatoria' }]} />
                  )}

                  {/* Quando resposta for "Sim" */}
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-emerald-500">Quando resposta for &quot;Sim&quot;:</p>
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onYes').showTextField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onYes', { showTextField: true }); else clearCondField('onYes', 'showTextField', 'textFieldLabel', 'textFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir texto explicativo
                    </label>
                    {!!getCondBlock('onYes').showTextField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onYes').textFieldLabel as string) || ''} onChange={(e) => setCondBlock('onYes', { textFieldLabel: e.target.value })} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onYes').textFieldRequired === true} onChange={(e) => setCondBlock('onYes', { textFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Texto obrigatorio
                        </label>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onYes').showPhotoField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onYes', { showPhotoField: true }); else clearCondField('onYes', 'showPhotoField', 'photoFieldLabel', 'photoFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir foto
                    </label>
                    {!!getCondBlock('onYes').showPhotoField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onYes').photoFieldLabel as string) || ''} onChange={(e) => setCondBlock('onYes', { photoFieldLabel: e.target.value })} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onYes').photoFieldRequired === true} onChange={(e) => setCondBlock('onYes', { photoFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Foto obrigatoria
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Quando resposta for "Nao" */}
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-red-400">Quando resposta for &quot;Nao&quot;:</p>
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onNo').showTextField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onNo', { showTextField: true }); else clearCondField('onNo', 'showTextField', 'textFieldLabel', 'textFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir texto explicativo
                    </label>
                    {!!getCondBlock('onNo').showTextField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onNo').textFieldLabel as string) || ''} onChange={(e) => setCondBlock('onNo', { textFieldLabel: e.target.value })} placeholder="Label do campo (ex: Explique o motivo)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onNo').textFieldRequired === true} onChange={(e) => setCondBlock('onNo', { textFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Texto obrigatorio
                        </label>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onNo').showPhotoField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onNo', { showPhotoField: true }); else clearCondField('onNo', 'showPhotoField', 'photoFieldLabel', 'photoFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir foto
                    </label>
                    {!!getCondBlock('onNo').showPhotoField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onNo').photoFieldLabel as string) || ''} onChange={(e) => setCondBlock('onNo', { photoFieldLabel: e.target.value })} placeholder="Label da foto (ex: Foto da evidencia)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onNo').photoFieldRequired === true} onChange={(e) => setCondBlock('onNo', { photoFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Foto obrigatoria
                        </label>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onNo').allowUserActionPlan === true}
                        onChange={(e) => setCondBlock('onNo', { allowUserActionPlan: e.target.checked })}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Permitir preenchedor escolher responsavel
                    </label>
                  </div>

                  {/* Quando resposta for "N/A" */}
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-amber-500">Quando resposta for &quot;N/A&quot;:</p>
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onNa').showTextField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onNa', { showTextField: true }); else clearCondField('onNa', 'showTextField', 'textFieldLabel', 'textFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir texto explicativo
                    </label>
                    {!!getCondBlock('onNa').showTextField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onNa').textFieldLabel as string) || ''} onChange={(e) => setCondBlock('onNa', { textFieldLabel: e.target.value })} placeholder="Label do campo (ex: Motivo do N/A)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onNa').textFieldRequired === true} onChange={(e) => setCondBlock('onNa', { textFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Texto obrigatorio
                        </label>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer">
                      <input type="checkbox" checked={getCondBlock('onNa').showPhotoField === true}
                        onChange={(e) => { if (e.target.checked) setCondBlock('onNa', { showPhotoField: true }); else clearCondField('onNa', 'showPhotoField', 'photoFieldLabel', 'photoFieldRequired') }}
                        className="rounded border-default bg-surface text-primary focus:ring-primary" />
                      Exigir foto
                    </label>
                    {!!getCondBlock('onNa').showPhotoField && (
                      <div className="ml-6 space-y-2">
                        <input type="text" value={(getCondBlock('onNa').photoFieldLabel as string) || ''} onChange={(e) => setCondBlock('onNa', { photoFieldLabel: e.target.value })} placeholder="Label da foto (ex: Foto de referencia)" className="input text-sm" />
                        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                          <input type="checkbox" checked={getCondBlock('onNa').photoFieldRequired === true} onChange={(e) => setCondBlock('onNa', { photoFieldRequired: e.target.checked })} className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3" />
                          Foto obrigatoria
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                )
              })()}

              {/* Cross-validation */}
              {!['dropdown', 'checkbox_multiple'].includes(field.field_type) && (
                <div>
                  <label className="block text-xs text-muted mb-1">Validacao cruzada</label>
                  <Select
                    value={
                      (field.options as { validationRole?: string } | null)?.validationRole || ''
                    }
                    onChange={(v) =>
                      onFieldUpdate(field.id, {
                        options: {
                          ...((field.options as Record<string, unknown>) || {}),
                          validationRole: v || null,
                        },
                      })
                    }
                    className="text-sm"
                    placeholder="Nenhum"
                    options={[
                      { value: 'nota', label: 'Numero da nota' },
                      { value: 'valor', label: 'Valor' },
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </SortableFieldItem>
  )

  if (!isOpen || !section) return null

  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order)
  const sortedSubs = [...subSections].sort((a, b) => a.sort_order - b.sort_order)

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-subtle shrink-0">
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={section.name}
              onChange={(e) => onSectionUpdate(section.id, { name: e.target.value })}
              placeholder="Nome da etapa"
              className="w-full bg-transparent border-none text-lg font-semibold text-main placeholder:text-muted focus:outline-none"
            />
            <input
              type="text"
              value={section.description}
              onChange={(e) => onSectionUpdate(section.id, { description: e.target.value })}
              placeholder="Descricao (opcional)"
              className="w-full bg-transparent border-none text-sm text-secondary placeholder:text-muted focus:outline-none mt-0.5"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors shrink-0"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Sub-sections accordion */}
          {(sortedSubs.length > 0 || true) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-secondary">Sub-etapas</h3>
                <button
                  type="button"
                  onClick={() => onSubSectionAdd(section.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  Adicionar Sub-etapa
                </button>
              </div>

              {sortedSubs.length === 0 ? (
                <p className="text-xs text-muted italic py-2">
                  Nenhuma sub-etapa. Campos ficam diretamente nesta etapa.
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedSubs.map((sub) => (
                    <div
                      key={sub.id}
                      className="border border-subtle rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-surface hover:bg-surface-hover cursor-pointer transition-colors"
                        onClick={() => toggleSub(sub.id)}
                      >
                        {expandedSubs[sub.id] ? (
                          <FiChevronUp className="w-3.5 h-3.5 text-muted" />
                        ) : (
                          <FiChevronDown className="w-3.5 h-3.5 text-muted" />
                        )}
                        <span className="text-sm font-medium text-main flex-1 truncate">
                          {sub.name || '(sem nome)'}
                        </span>
                        <span className="text-xs text-muted">
                          {fields.filter((f) => f.section_id === sub.id).length} campos
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSubSectionDelete(sub.id)
                          }}
                          className="p-1 text-error hover:bg-error/20 rounded transition-colors"
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {expandedSubs[sub.id] && (
                        <div className="px-3 py-2 border-t border-subtle bg-page/50">
                          <p className="text-xs text-muted mb-2">
                            Campos desta sub-etapa sao editados abaixo na lista principal.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-subtle" />

          {/* Fields list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-secondary">
                Campos ({sortedFields.length})
              </h3>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowFieldTypePicker(showFieldTypePicker ? null : section.id)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  Adicionar Campo
                </button>

                {/* Field type quick-select dropdown */}
                {showFieldTypePicker === section.id && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-subtle rounded-xl shadow-lg py-1 w-56">
                    {FIELD_TYPES.map((ft) => (
                      <button
                        key={ft.value}
                        type="button"
                        onClick={() => {
                          onFieldAdd(section.id)
                          setShowFieldTypePicker(null)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-main hover:bg-primary/10 transition-colors text-left"
                      >
                        <span className="w-6 text-center text-xs">{ft.icon}</span>
                        <span>{ft.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {sortedFields.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted">
                  Nenhum campo nesta etapa. Adicione campos acima.
                </p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleFieldDragEnd}
              >
                <SortableContext
                  items={sortedFields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {sortedFields.map((field) => renderFieldItem(field))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-subtle shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted hover:text-main hover:bg-surface-hover rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
