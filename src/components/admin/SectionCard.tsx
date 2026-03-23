'use client'

import React from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
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

// ─── Types ──────────────────────────────────────────────────────────────────

type SectionItem = {
  id: string
  name: string
  fieldCount: number
  subSectionCount: number
  sort_order: number
}

type FieldItem = {
  id: string
  name: string
  field_type: string
}

type Props = {
  templateName: string
  sections: SectionItem[]
  onSectionClick: (sectionId: string) => void
  onAddSection: () => void
  onReorder: (sections: SectionItem[]) => void
  onSectionDelete?: (sectionId: string) => void
  // Campos sem etapa (quando template nao tem secoes)
  looseFields?: FieldItem[]
  onLooseFieldsClick?: () => void
  onAddField?: () => void
}

// ─── Sortable row ───────────────────────────────────────────────────────────

function SortableSectionRow({
  section,
  index,
  onClick,
  onDelete,
}: {
  section: SectionItem
  index: number
  onClick: () => void
  onDelete?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

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
      {...attributes}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-primary/10 cursor-pointer transition-colors group"
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5 text-muted hover:text-primary touch-none opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <RiDraggable className="w-3.5 h-3.5" />
      </div>

      {/* Number badge */}
      <span className="flex items-center justify-center bg-primary text-primary-foreground rounded-full w-6 h-6 text-xs font-semibold shrink-0">
        {index + 1}
      </span>

      {/* Section name */}
      <span className="text-sm font-medium text-main truncate flex-1">
        {section.name || '(sem nome)'}
      </span>

      {/* Field count badge */}
      <span className="text-xs text-muted shrink-0 tabular-nums">
        {section.fieldCount} campo{section.fieldCount !== 1 ? 's' : ''}
        {section.subSectionCount > 0 && (
          <> &middot; {section.subSectionCount} sub</>
        )}
      </span>

      {/* Delete button */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="p-1 text-muted hover:text-error hover:bg-error/10 rounded transition-colors opacity-0 group-hover:opacity-100"
          title="Apagar etapa"
        >
          <FiTrash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SectionCard({
  templateName,
  sections,
  onSectionClick,
  onAddSection,
  onReorder,
  onSectionDelete,
  looseFields = [],
  onLooseFieldsClick,
  onAddField,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = sections.findIndex((s) => s.id === active.id)
    const newIdx = sections.findIndex((s) => s.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(sections, oldIdx, newIdx).map((s, i) => ({
      ...s,
      sort_order: i + 1,
    }))
    onReorder(reordered)
  }

  return (
    <div
      data-node-id="center"
      className="min-w-[320px] max-w-[700px] border-2 border-primary rounded-2xl bg-primary/5 shadow-sm flex flex-col"
      style={{ resize: 'horizontal', overflow: 'auto', width: 400 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20">
        <h2 className="text-lg font-bold text-main truncate">{templateName || 'Novo Checklist'}</h2>
        <div className="flex items-center gap-1.5">
          {onAddField && (
            <button
              type="button"
              onClick={onAddField}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-surface border border-subtle text-xs font-medium rounded-lg hover:border-primary/40 text-secondary hover:text-primary transition-colors shrink-0"
            >
              <FiPlus className="w-3 h-3" />
              Campo
            </button>
          )}
          <button
            type="button"
            onClick={onAddSection}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors shrink-0"
          >
            <FiPlus className="w-3 h-3" />
            Etapa
          </button>
        </div>
      </div>

      {/* Content: sections + loose fields */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* Loose fields (campos sem etapa) */}
        {looseFields.length > 0 && (
          <div className="mb-2">
            <button
              type="button"
              onClick={onLooseFieldsClick}
              className="w-full text-left px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-amber-600">Campos Gerais</span>
                <span className="text-[10px] text-amber-500">{looseFields.length} campos</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {looseFields.slice(0, 4).map(f => (
                  <span key={f.id} className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded">{f.name || '(sem nome)'}</span>
                ))}
                {looseFields.length > 4 && (
                  <span className="text-[10px] text-muted">+{looseFields.length - 4}</span>
                )}
              </div>
            </button>
          </div>
        )}

        {sections.length === 0 && looseFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-sm text-muted">
              Nenhuma etapa ou campo. Adicione uma etapa ou campo para começar.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {sections.map((section, index) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    index={index}
                    onClick={() => onSectionClick(section.id)}
                    onDelete={onSectionDelete ? () => onSectionDelete(section.id) : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
