'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiCopy,
  FiSearch,
  FiClipboard,
  FiWifiOff,
  FiStar,
  FiChevronDown,
  FiMoreVertical,
  FiMenu,
  FiMapPin,
  FiFile,
  FiAlertTriangle,
} from 'react-icons/fi'
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
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header, PageContainer } from '@/components/ui'
import type { ChecklistTemplate, TemplateField, TemplateVisibility, Store } from '@/types/database'
import { getAuthCache, getUserCache, getTemplatesCache, getStoresCache } from '@/lib/offlineCache'

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [checklistCounts, setChecklistCounts] = useState<Record<number, number>>({})
  const [recentChecklists, setRecentChecklists] = useState<Record<number, { id: number; store_name: string; status: string; created_at: string }[]>>({})
  const [activeMenu, setActiveMenu] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    fetchTemplates()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTemplates = async () => {
    let userId: string | null = null
    let isAdmin = false

    // Tenta verificar acesso online
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        const { data: profile } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
      }
    } catch {
      console.log('[Templates] Falha ao verificar online, tentando cache...')
    }

    // Fallback para cache se offline
    if (!userId) {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          userId = cachedAuth.userId
          const cachedUser = await getUserCache(cachedAuth.userId)
          isAdmin = cachedUser?.is_admin || false
        }
      } catch {
        console.log('[Templates] Falha ao buscar cache')
      }
    }

    if (!userId) {
      router.push(APP_CONFIG.routes.login)
      return
    }

    if (!isAdmin) {
      router.push(APP_CONFIG.routes.dashboard)
      return
    }

    setCurrentUserId(userId)

    // Buscar favoritos
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: favs } = await (supabase as any)
        .from('admin_favorites')
        .select('entity_id')
        .eq('user_id', userId)
        .eq('entity_type', 'template')

      if (favs) {
        setFavoriteIds(new Set(favs.map((f: { entity_id: string }) => Number(f.entity_id))))
      }
    } catch {
      // Favoritos não são críticos
    }

    // Tenta buscar online
    try {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          fields:template_fields(*),
          visibility:template_visibility(
            *,
            store:stores(*)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setTemplates(data as TemplateWithDetails[])
      setIsOffline(false)
    } catch (err) {
      console.error('[Templates] Erro ao buscar online:', err)

      // Fallback para cache offline
      try {
        const [cachedTemplates, cachedStores] = await Promise.all([
          getTemplatesCache(),
          getStoresCache(),
        ])

        const templatesWithDetails = cachedTemplates.map(template => ({
          ...template,
          fields: [],
          visibility: cachedStores.map(store => ({
            id: 0,
            template_id: template.id,
            store_id: store.id,
            sector_id: null,
            roles: [] as string[],
            assigned_by: null,
            assigned_at: new Date().toISOString(),
            store,
          })) as unknown as (TemplateVisibility & { store: Store })[],
        })) as TemplateWithDetails[]

        setTemplates(templatesWithDetails)
        setIsOffline(true)
        console.log('[Templates] Carregado do cache offline')
      } catch (cacheErr) {
        console.error('[Templates] Erro ao buscar cache:', cacheErr)
      }
    }

    // Buscar contagem de checklists por template
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: counts } = await (supabase as any)
        .from('checklists')
        .select('template_id')
      if (counts) {
        const map: Record<number, number> = {}
        for (const c of counts) {
          map[c.template_id] = (map[c.template_id] || 0) + 1
        }
        setChecklistCounts(map)
      }
    } catch { /* nao critico */ }

    setLoading(false)
  }

  // Buscar checklists recentes ao expandir um template
  const loadRecentChecklists = useCallback(async (templateId: number) => {
    if (recentChecklists[templateId]) return // ja carregado
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('checklists')
        .select('id, status, created_at, store:stores(name)')
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (data) {
        setRecentChecklists(prev => ({
          ...prev,
          [templateId]: data.map((c: { id: number; status: string; created_at: string; store: { name: string } | null }) => ({
            id: c.id,
            store_name: c.store?.name || 'Sem loja',
            status: c.status,
            created_at: c.created_at,
          })),
        }))
      }
    } catch { /* nao critico */ }
  }, [recentChecklists, supabase])

  const toggleExpand = useCallback((templateId: number) => {
    setExpandedId(prev => {
      if (prev === templateId) return null
      loadRecentChecklists(templateId)
      return templateId
    })
  }, [loadRecentChecklists])

  // Drag-and-drop: reordenar templates
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setTemplates(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const toggleTemplateStatus = async (templateId: number, currentStatus: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('checklist_templates')
      .update({ is_active: !currentStatus })
      .eq('id', templateId)

    if (error) {
      console.error('Error updating template:', error)
      return
    }

    fetchTemplates()
  }

  const duplicateTemplate = async (template: TemplateWithDetails) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    // 1. Criar template com TODOS os metadados
    const { data: newTemplate, error: templateError } = await sb
      .from('checklist_templates')
      .insert({
        name: `${template.name} (Cópia)`,
        description: template.description,
        category: template.category,
        is_active: false,
        allowed_start_time: template.allowed_start_time ?? null,
        allowed_end_time: template.allowed_end_time ?? null,
        justification_deadline_hours: template.justification_deadline_hours ?? null,
        admin_only: template.admin_only ?? false,
      })
      .select()
      .single()

    if (templateError || !newTemplate) {
      console.error('Error duplicating template:', templateError)
      return
    }

    // 2. Copiar sections e mapear IDs antigos → novos
    const sectionIdMap: Record<number, number> = {}

    const { data: originalSections } = await sb
      .from('template_sections')
      .select('*')
      .eq('template_id', template.id)
      .order('sort_order')

    if (originalSections && originalSections.length > 0) {
      for (const section of originalSections) {
        const { data: newSection, error: sectionError } = await sb
          .from('template_sections')
          .insert({
            template_id: newTemplate.id,
            name: section.name,
            description: section.description,
            sort_order: section.sort_order,
          })
          .select()
          .single()

        if (sectionError || !newSection) {
          console.error('Error copying section:', sectionError)
          continue
        }
        sectionIdMap[section.id] = newSection.id
      }
    }

    // 3. Copiar fields com .select() para obter novos IDs (necessario para conditions)
    const fieldIdMap: Record<number, number> = {}

    if (template.fields.length > 0) {
      // Inserir campo por campo para manter mapeamento de IDs
      for (const f of template.fields) {
        const { data: newField, error: fieldError } = await sb
          .from('template_fields')
          .insert({
            template_id: newTemplate.id,
            name: f.name,
            field_type: f.field_type,
            is_required: f.is_required,
            sort_order: f.sort_order,
            options: f.options,
            validation: f.validation,
            calculation: f.calculation,
            placeholder: f.placeholder,
            help_text: f.help_text,
            section_id: f.section_id ? sectionIdMap[f.section_id] || null : null,
          })
          .select()
          .single()

        if (fieldError || !newField) {
          console.error('Error copying field:', fieldError)
          continue
        }
        fieldIdMap[f.id] = newField.id
      }
    }

    // 4. Copiar field_conditions (regras de nao-conformidade)
    const originalFieldIds = template.fields.map(f => f.id)
    if (originalFieldIds.length > 0) {
      const { data: conditions } = await sb
        .from('field_conditions')
        .select('*')
        .in('field_id', originalFieldIds)

      if (conditions && conditions.length > 0) {
        const conditionRows = conditions
          .filter((c: { field_id: number }) => fieldIdMap[c.field_id])
          .map((c: { field_id: number; condition_type: string; condition_value: unknown; severity: string; default_assignee_id: string | null; deadline_days: number; description_template: string | null; is_active: boolean; require_photo_on_completion: boolean | null; require_text_on_completion: boolean | null; completion_max_chars: number | null }) => ({
            field_id: fieldIdMap[c.field_id],
            condition_type: c.condition_type,
            condition_value: c.condition_value,
            severity: c.severity,
            default_assignee_id: c.default_assignee_id,
            deadline_days: c.deadline_days,
            description_template: c.description_template,
            is_active: c.is_active,
            require_photo_on_completion: c.require_photo_on_completion ?? false,
            require_text_on_completion: c.require_text_on_completion ?? false,
            completion_max_chars: c.completion_max_chars ?? null,
          }))

        if (conditionRows.length > 0) {
          const { error: condError } = await sb
            .from('field_conditions')
            .insert(conditionRows)
          if (condError) console.error('Error copying conditions:', condError)
        }
      }
    }

    // 5. Copiar template_visibility (quais lojas/setores/funcoes veem o template)
    if (template.visibility && template.visibility.length > 0) {
      const visibilityRows = template.visibility.map((v: { store_id: number; sector_id: number | null; function_id: number | null; roles: string[] | null }) => ({
        template_id: newTemplate.id,
        store_id: v.store_id,
        sector_id: v.sector_id ?? null,
        function_id: v.function_id ?? null,
        roles: v.roles ?? [],
      }))

      const { error: visError } = await sb
        .from('template_visibility')
        .insert(visibilityRows)
      if (visError) console.error('Error copying visibility:', visError)
    }

    fetchTemplates()
  }

  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Tem certeza que deseja excluir este checklist e todos os dados preenchidos? Esta ação não pode ser desfeita.')) return

    try {
      // Exclui checklists vinculados primeiro (responses são CASCADE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('checklists')
        .delete()
        .eq('template_id', templateId)

      // Agora exclui o template (fields e visibility são CASCADE)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('checklist_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      fetchTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Erro ao excluir checklist')
    }
  }

  const toggleFavorite = async (templateId: number) => {
    if (!currentUserId) return
    const isFav = favoriteIds.has(templateId)

    // Otimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev)
      if (isFav) next.delete(templateId)
      else next.add(templateId)
      return next
    })

    try {
      if (isFav) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('admin_favorites')
          .delete()
          .eq('user_id', currentUserId)
          .eq('entity_type', 'template')
          .eq('entity_id', String(templateId))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('admin_favorites')
          .insert({ user_id: currentUserId, entity_type: 'template', entity_id: String(templateId) })
      }
    } catch {
      // Reverter em caso de erro
      setFavoriteIds(prev => {
        const next = new Set(prev)
        if (isFav) next.add(templateId)
        else next.delete(templateId)
        return next
      })
    }
  }

  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch =
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory = !filterCategory || template.category === filterCategory
      const matchesFavorite = !showFavoritesOnly || favoriteIds.has(template.id)
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' ? template.is_active : !template.is_active)

      return matchesSearch && matchesCategory && matchesFavorite && matchesStatus
    })
    .sort((a, b) => {
      const aFav = favoriteIds.has(a.id) ? 1 : 0
      const bFav = favoriteIds.has(b.id) ? 1 : 0
      return bFav - aFav
    })

  const categories = ['recebimento', 'limpeza', 'abertura', 'fechamento', 'outros']

  const getCategoryColor = (category: string | null) => {
    const colors: Record<string, string> = {
      recebimento: 'bg-emerald-500/20 text-emerald-400',
      limpeza: 'bg-blue-500/20 text-blue-400',
      abertura: 'bg-amber-500/20 text-amber-400',
      fechamento: 'bg-purple-500/20 text-purple-400',
      outros: 'bg-surface text-muted',
    }
    return colors[category || 'outros'] || colors.outros
  }


  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      concluido: { label: 'Concluido', cls: 'bg-primary/20 text-primary' },
      validado: { label: 'Validado', cls: 'bg-success/20 text-success' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-warning/20 text-warning' },
      incompleto: { label: 'Incompleto', cls: 'bg-error/20 text-error' },
      rascunho: { label: 'Rascunho', cls: 'bg-surface-hover text-muted' },
    }
    return map[status] || { label: status, cls: 'bg-surface text-muted' }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-page" onClick={() => setActiveMenu(null)}>
      <Header
        title="Modelos de Checklist"
        icon={FiClipboard}
        backHref={APP_CONFIG.routes.admin}
        actions={isOffline ? [] : [
          { label: 'Novo Checklist', href: APP_CONFIG.routes.adminTemplatesNew, icon: FiPlus, variant: 'primary' },
        ]}
      />

      <PageContainer>
        {isOffline && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-6 flex items-center gap-3">
            <FiWifiOff className="w-5 h-5 text-warning" />
            <p className="text-warning text-sm">Voce esta offline. Edicoes nao estao disponiveis.</p>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface border border-subtle rounded-xl text-sm text-main placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${showFavoritesOnly ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'btn-secondary'}`}>
                <FiStar className={`w-3 h-3 ${showFavoritesOnly ? 'fill-amber-400' : ''}`} /> Fav
              </button>
              {(['all', 'active', 'inactive'] as const).map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}>
                  {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterCategory(null)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterCategory === null ? 'btn-primary' : 'btn-secondary'}`}>
              Todas categorias
            </button>
            {categories.map(cat => (
              <button key={cat} onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filterCategory === cat ? 'btn-primary' : 'btn-secondary'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de capsulas */}
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16 card rounded-2xl">
            <p className="text-muted">Nenhum template encontrado</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredTemplates.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {filteredTemplates.map(template => {
                  const storeCount = new Set(template.visibility.map(v => v.store_id)).size
                  const clCount = checklistCounts[template.id] || 0
                  const isExpanded = expandedId === template.id
                  const recents = recentChecklists[template.id] || []

                  return (
                    <SortableTemplateCard
                      key={template.id}
                      template={template}
                      storeCount={storeCount}
                      clCount={clCount}
                      isExpanded={isExpanded}
                      recents={recents}
                      isFavorite={favoriteIds.has(template.id)}
                      isOffline={isOffline}
                      activeMenu={activeMenu}
                      getCategoryColor={getCategoryColor}
                      getStatusBadge={getStatusBadge}
                      onToggleExpand={() => toggleExpand(template.id)}
                      onToggleFavorite={() => toggleFavorite(template.id)}
                      onDuplicate={() => duplicateTemplate(template)}
                      onToggleStatus={() => toggleTemplateStatus(template.id, template.is_active)}
                      onDelete={() => deleteTemplate(template.id)}
                      onMenuToggle={(id) => { setActiveMenu(prev => prev === id ? null : id) }}
                    />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <p>{filteredTemplates.length} de {templates.length} templates</p>
          <p>{templates.filter(t => t.is_active).length} ativos</p>
        </div>
      </PageContainer>
    </div>
  )
}

// === Componente de capsula sortable ===
function SortableTemplateCard({
  template, storeCount, clCount, isExpanded, recents, isFavorite, isOffline, activeMenu,
  getCategoryColor, getStatusBadge,
  onToggleExpand, onToggleFavorite, onDuplicate, onToggleStatus, onDelete, onMenuToggle,
}: {
  template: TemplateWithDetails
  storeCount: number
  clCount: number
  isExpanded: boolean
  recents: { id: number; store_name: string; status: string; created_at: string }[]
  isFavorite: boolean
  isOffline: boolean
  activeMenu: number | null
  getCategoryColor: (cat: string | null) => string
  getStatusBadge: (status: string) => { label: string; cls: string }
  onToggleExpand: () => void
  onToggleFavorite: () => void
  onDuplicate: () => void
  onToggleStatus: () => void
  onDelete: () => void
  onMenuToggle: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id })
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined }

  // Animacao spring gelatinosa
  const springConfig = { type: 'spring' as const, stiffness: 300, damping: 20, mass: 0.8 }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      whileHover={{ scale: 1.008, y: -1 }}
      whileTap={{ scale: 0.995 }}
      transition={springConfig}
      className={`card rounded-xl ${!template.is_active ? 'opacity-50' : ''}`}
    >
      {/* Capsula principal */}
      <div className="flex items-center gap-2 px-3 py-3 cursor-pointer select-none" onClick={onToggleExpand}>
        {/* Drag handle */}
        <button {...attributes} {...listeners} className="p-1 text-muted hover:text-main cursor-grab active:cursor-grabbing touch-none" onClick={e => e.stopPropagation()}>
          <FiMenu className="w-4 h-4" />
        </button>

        {/* Favorito com animacao de bounce */}
        <motion.button
          onClick={e => { e.stopPropagation(); onToggleFavorite() }}
          whileTap={{ scale: 1.4, rotate: 15 }}
          transition={{ type: 'spring', stiffness: 500, damping: 10 }}
          className={`p-0.5 ${isFavorite ? 'text-amber-400' : 'text-muted/30 hover:text-amber-400'}`}
        >
          <FiStar className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
        </motion.button>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-main truncate">{template.name}</h3>
            <span className={`shrink-0 px-1.5 py-0.5 text-[10px] rounded capitalize ${getCategoryColor(template.category)}`}>
              {template.category || 'outros'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted mt-0.5">
            <span className="flex items-center gap-1"><FiFile className="w-3 h-3" />{template.fields.length} campos</span>
            <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" />{storeCount} lojas</span>
            {clCount > 0 && <span className="flex items-center gap-1"><FiClipboard className="w-3 h-3" />{clCount} preenchidos</span>}
            {(template.allowed_start_time || template.allowed_end_time) && (
              <span className="flex items-center gap-1"><FiAlertTriangle className="w-3 h-3" />Horario restrito</span>
            )}
          </div>
        </div>

        {/* Status badge com pulse */}
        <motion.span
          animate={template.is_active ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          className={`shrink-0 w-2.5 h-2.5 rounded-full ${template.is_active ? 'bg-success' : 'bg-error'}`}
          title={template.is_active ? 'Ativo' : 'Inativo'}
        />

        {/* Expand arrow com rotacao spring */}
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={springConfig}>
          <FiChevronDown className="w-4 h-4 text-muted" />
        </motion.div>

        {/* Menu de acoes */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <motion.button whileTap={{ scale: 0.85 }} onClick={() => onMenuToggle(template.id)}
            className="p-1.5 text-muted hover:text-main hover:bg-surface rounded-lg">
            <FiMoreVertical className="w-4 h-4" />
          </motion.button>
          <AnimatePresence>
            {activeMenu === template.id && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-xl shadow-xl z-50 py-1 w-44 origin-top-right"
              >
                {!isOffline && (
                  <Link href={`${APP_CONFIG.routes.adminTemplates}/${template.id}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-main hover:bg-surface-hover w-full">
                    <FiEdit2 className="w-3.5 h-3.5" /> Editar
                  </Link>
                )}
                <button onClick={onDuplicate} disabled={isOffline}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-main hover:bg-surface-hover w-full disabled:opacity-50">
                  <FiCopy className="w-3.5 h-3.5" /> Duplicar
                </button>
                <button onClick={onToggleStatus} disabled={isOffline}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-main hover:bg-surface-hover w-full disabled:opacity-50">
                  {template.is_active ? <FiEyeOff className="w-3.5 h-3.5" /> : <FiEye className="w-3.5 h-3.5" />}
                  {template.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <div className="border-t border-subtle my-1" />
                <button onClick={onDelete} disabled={isOffline}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error/10 w-full disabled:opacity-50">
                  <FiTrash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Conteudo expandido — animacao tipo grafo com stagger */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, mass: 0.8 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-subtle pt-3">
              {/* Descricao — aparece primeiro */}
              {template.description && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05, ...springConfig }}
                  className="text-xs text-secondary mb-3"
                >
                  {template.description}
                </motion.p>
              )}

              {/* Lojas — cada pill brota com stagger */}
              {template.visibility.length > 0 && (
                <div className="mb-3">
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                    className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Visivel em</motion.p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(new Map(template.visibility.map(v => [v.store_id, v])).values()).map((v, i) => (
                      <motion.span
                        key={v.store_id}
                        initial={{ opacity: 0, scale: 0, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 400, damping: 15 }}
                        className="px-2.5 py-1 text-[11px] bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20"
                      >
                        {v.store?.name || `Loja ${v.store_id}`}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklists recentes — cada item desliza como no de grafo */}
              {clCount > 0 && (
                <div>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                    className="text-[10px] text-muted uppercase tracking-wider mb-1.5">Ultimos preenchidos</motion.p>
                  {recents.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary/30 animate-pulse" />
                      <p className="text-xs text-muted">Carregando...</p>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-primary/20">
                      {recents.map((cl, i) => {
                        const badge = getStatusBadge(cl.status)
                        return (
                          <motion.div
                            key={cl.id}
                            initial={{ opacity: 0, x: -20, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            transition={{ delay: 0.15 + i * 0.08, type: 'spring', stiffness: 350, damping: 18 }}
                            className="flex items-center gap-2 text-xs bg-surface/50 rounded-lg px-2.5 py-1.5 -ml-[9px]"
                          >
                            <div className="w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                            <span className="text-secondary truncate flex-1">{cl.store_name}</span>
                            <span className="text-muted shrink-0">{new Date(cl.created_at).toLocaleDateString('pt-BR')}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${badge.cls}`}>{badge.label}</span>
                          </motion.div>
                        )
                      })}
                      {clCount > 5 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
                          <Link href={`${APP_CONFIG.routes.adminChecklists}?template=${template.id}`}
                            className="text-xs text-primary hover:underline ml-2">
                            Ver todos ({clCount}) →
                          </Link>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {clCount === 0 && !template.description && template.visibility.length === 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs text-muted">Nenhum dado adicional.</motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

type TemplateWithDetails = ChecklistTemplate & {
  fields: TemplateField[]
  visibility: (TemplateVisibility & { store: Store })[]
}
