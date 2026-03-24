'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { FiSearch, FiUsers, FiHome, FiFileText, FiAlertTriangle, FiGrid, FiClipboard, FiCheckSquare, FiLayers, FiChevronRight } from 'react-icons/fi'
import { useDebouncedCallback } from 'use-debounce'
import { createClient } from '@/lib/supabase'
import type { IconType } from 'react-icons'

// ============================================
// TYPES
// ============================================

type SearchResult = {
  id: string
  title: string
  subtitle?: string
  href: string
  badge?: { label: string; color: string }
}

type SearchCategory = {
  key: string
  label: string
  icon: IconType
  results: SearchResult[]
  hasMore: boolean
}

// ============================================
// ADMIN MODULES (local, no DB)
// ============================================

const ADMIN_MODULES: { title: string; description: string; href: string; icon: IconType }[] = [
  { title: 'Usuários', description: 'Gerenciar usuários e permissões', href: '/admin/usuarios', icon: FiUsers },
  { title: 'Checklists', description: 'Criar e editar modelos', href: '/admin/templates', icon: FiFileText },
  { title: 'Lojas', description: 'Gerenciar unidades', href: '/admin/lojas', icon: FiHome },
  { title: 'Setores', description: 'Cozinha, Estoque, Salão', href: '/admin/setores', icon: FiGrid },
  { title: 'Funções', description: 'Cozinheiro, Zelador, Garçom', href: '/admin/funcoes', icon: FiClipboard },
  { title: 'Validações', description: 'Estoquista vs Aprendiz', href: '/admin/validacoes', icon: FiLayers },
  { title: 'Respostas', description: 'Gerenciar e excluir', href: '/admin/checklists', icon: FiCheckSquare },
  { title: 'Planos de Ação', description: 'Não conformidades e ações', href: '/admin/planos-de-acao', icon: FiAlertTriangle },
  { title: 'Relatórios', description: 'Estatísticas e análises', href: '/admin/relatorios', icon: FiLayers },
  { title: 'Configurações', description: 'Email templates e ajustes', href: '/admin/configuracoes', icon: FiLayers },
  { title: 'Galeria', description: 'Fotos e anexos', href: '/admin/galeria', icon: FiLayers },
]

// ============================================
// SEVERITY BADGE CONFIG
// ============================================

const SEVERITY_COLORS: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  media: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  baixa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

// ============================================
// HIGHLIGHT COMPONENT
// ============================================

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/20 text-main rounded-sm px-0.5">{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  )
}

// ============================================
// ESCAPE WILDCARDS
// ============================================

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

// ============================================
// GLOBAL SEARCH COMPONENT
// ============================================

type GlobalSearchProps = {
  placeholder?: string
}

/**
 * Campo de busca global com dropdown de resultados categorizados.
 * Busca simultaneamente em checklists, planos de ação, usuários e lojas no Supabase.
 * Debounce de 300ms para evitar requisições excessivas durante a digitação.
 * Suporta navegação por teclado (setas ↑↓, Enter para navegar, Escape para fechar).
 */
export function GlobalSearch({ placeholder = 'Buscar módulos, relatórios, usuários...' }: GlobalSearchProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [categories, setCategories] = useState<SearchCategory[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const latestQueryRef = useRef('')

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    const items: { href: string; categoryIndex: number; resultIndex: number }[] = []
    categories.forEach((cat, ci) => {
      cat.results.forEach((r, ri) => {
        items.push({ href: r.href, categoryIndex: ci, resultIndex: ri })
      })
    })
    return items
  }, [categories])

  // ============================================
  // SEARCH LOGIC
  // ============================================

  const performSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2) {
      setCategories([])
      setIsLoading(false)
      return
    }

    latestQueryRef.current = trimmed
    setIsLoading(true)

    const escaped = escapeIlike(trimmed)
    const pattern = `%${escaped}%`
    const limit = 4 // fetch 4 to detect "has more" — show max 3

    const results = await Promise.allSettled([
      // 0: Modulos (local)
      Promise.resolve(
        ADMIN_MODULES.filter(m =>
          m.title.toLowerCase().includes(trimmed.toLowerCase()) ||
          m.description.toLowerCase().includes(trimmed.toLowerCase())
        )
      ),
      // 1: Usuarios
      supabase
        .from('users')
        .select('id, full_name, email')
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(limit),
      // 2: Lojas
      supabase
        .from('stores')
        .select('id, name, cnpj')
        .or(`name.ilike.${pattern},cnpj.ilike.${pattern}`)
        .limit(limit),
      // 3: Templates
      supabase
        .from('checklist_templates')
        .select('id, name')
        .ilike('name', pattern)
        .limit(limit),
      // 4: Planos de Acao
      supabase
        .from('action_plans')
        .select('id, title, severity')
        .ilike('title', pattern)
        .limit(limit),
      // 5: Setores
      supabase
        .from('sectors')
        .select('id, name, store_id, store:stores(name)')
        .ilike('name', pattern)
        .limit(limit),
      // 6: Funcoes
      supabase
        .from('functions')
        .select('id, name')
        .ilike('name', pattern)
        .limit(limit),
      // 7: Templates for checklist search
      supabase
        .from('checklist_templates')
        .select('id')
        .ilike('name', pattern)
        .limit(20),
    ])

    // Discard stale results
    if (latestQueryRef.current !== trimmed) return

    const cats: SearchCategory[] = []

    // 0: Modulos
    if (results[0].status === 'fulfilled') {
      const modules = results[0].value
      if (modules.length > 0) {
        cats.push({
          key: 'modulos',
          label: 'Módulos',
          icon: FiLayers,
          results: modules.slice(0, 3).map(m => ({
            id: m.href,
            title: m.title,
            subtitle: m.description,
            href: m.href,
          })),
          hasMore: modules.length > 3,
        })
      }
    }

    // 1: Usuarios
    if (results[1].status === 'fulfilled') {
      const { data } = results[1].value
      if (data && data.length > 0) {
        cats.push({
          key: 'usuarios',
          label: 'Usuários',
          icon: FiUsers,
          results: data.slice(0, 3).map((u: { id: string; full_name: string; email: string }) => ({
            id: u.id,
            title: u.full_name,
            subtitle: u.email,
            href: `/admin/usuarios/${u.id}`,
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 2: Lojas
    if (results[2].status === 'fulfilled') {
      const { data } = results[2].value
      if (data && data.length > 0) {
        cats.push({
          key: 'lojas',
          label: 'Lojas',
          icon: FiHome,
          results: data.slice(0, 3).map((s: { id: number; name: string; cnpj: string | null }) => ({
            id: String(s.id),
            title: s.name,
            subtitle: s.cnpj || undefined,
            href: '/admin/lojas',
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 3: Templates
    if (results[3].status === 'fulfilled') {
      const { data } = results[3].value
      if (data && data.length > 0) {
        cats.push({
          key: 'templates',
          label: 'Templates',
          icon: FiFileText,
          results: data.slice(0, 3).map((t: { id: number; name: string }) => ({
            id: String(t.id),
            title: t.name,
            href: `/admin/templates/${t.id}`,
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 4: Planos de Acao
    if (results[4].status === 'fulfilled') {
      const { data } = results[4].value
      if (data && data.length > 0) {
        cats.push({
          key: 'planos',
          label: 'Planos de Ação',
          icon: FiAlertTriangle,
          results: data.slice(0, 3).map((p: { id: number; title: string; severity: string }) => ({
            id: String(p.id),
            title: p.title,
            href: `/admin/planos-de-acao/${p.id}`,
            badge: p.severity ? {
              label: p.severity,
              color: SEVERITY_COLORS[p.severity] || 'bg-gray-100 text-gray-700',
            } : undefined,
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 5: Setores
    if (results[5].status === 'fulfilled') {
      const { data } = results[5].value
      if (data && data.length > 0) {
        cats.push({
          key: 'setores',
          label: 'Setores',
          icon: FiGrid,
          results: data.slice(0, 3).map((s: { id: number; name: string; store?: { name: string } | null }) => ({
            id: String(s.id),
            title: s.name,
            subtitle: s.store?.name ? `Loja: ${s.store.name}` : undefined,
            href: '/admin/setores',
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 6: Funcoes
    if (results[6].status === 'fulfilled') {
      const { data } = results[6].value
      if (data && data.length > 0) {
        cats.push({
          key: 'funcoes',
          label: 'Funções',
          icon: FiClipboard,
          results: data.slice(0, 3).map((f: { id: number; name: string }) => ({
            id: String(f.id),
            title: f.name,
            href: '/admin/funcoes',
          })),
          hasMore: data.length > 3,
        })
      }
    }

    // 7: Checklists (via matching template IDs)
    if (results[7].status === 'fulfilled') {
      const { data: matchingTemplates } = results[7].value
      if (matchingTemplates && matchingTemplates.length > 0) {
        const templateIds = matchingTemplates.map((t: { id: number }) => t.id)
        const { data: checklists } = await supabase
          .from('checklists')
          .select('id, template_id, template:checklist_templates(name)')
          .in('template_id', templateIds)
          .limit(limit)

        if (latestQueryRef.current === trimmed && checklists && checklists.length > 0) {
          cats.push({
            key: 'checklists',
            label: 'Checklists',
            icon: FiCheckSquare,
            results: checklists.slice(0, 3).map((c: { id: number; template: { name: string } | null }) => ({
              id: String(c.id),
              title: c.template?.name || `Checklist #${c.id}`,
              subtitle: `#${c.id}`,
              href: `/checklist/${c.id}`,
            })),
            hasMore: checklists.length > 3,
          })
        }
      }
    }

    if (latestQueryRef.current === trimmed) {
      setCategories(cats)
      setIsLoading(false)
      setSelectedIndex(-1)
    }
  }, [supabase])

  const debouncedSearch = useDebouncedCallback(performSearch, 300)

  // ============================================
  // INPUT HANDLER
  // ============================================

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (value.trim().length >= 2) {
      setIsOpen(true)
      setIsLoading(true)
      debouncedSearch(value)
    } else {
      setIsOpen(false)
      setCategories([])
      setIsLoading(false)
    }
  }

  // ============================================
  // NAVIGATION
  // ============================================

  const navigateTo = useCallback((href: string) => {
    setIsOpen(false)
    setQuery('')
    setCategories([])
    inputRef.current?.blur()
    router.push(href)
  }, [router])

  // ============================================
  // KEYBOARD
  // ============================================

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : flatResults.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
          navigateTo(flatResults[selectedIndex].href)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  // ============================================
  // CTRL+K SHORTCUT
  // ============================================

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // ============================================
  // CLICK OUTSIDE
  // ============================================

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // ============================================
  // RENDER
  // ============================================

  // Track flat index for highlighting
  let flatIndex = -1

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <FiSearch className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted ${isLoading ? 'animate-pulse' : ''}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (query.trim().length >= 2) setIsOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-16 py-2 rounded-xl bg-surface-hover border border-subtle text-sm text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted bg-surface border border-subtle rounded-md">
          Ctrl+K
        </kbd>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full max-h-[70vh] overflow-y-auto rounded-xl border border-subtle shadow-theme-lg bg-surface z-50">
          {/* Loading */}
          {isLoading && categories.length === 0 && (
            <div className="px-4 py-8 text-center">
              <FiSearch className="w-6 h-6 text-muted mx-auto mb-2 animate-pulse" />
              <p className="text-sm text-muted">Buscando...</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && categories.length === 0 && query.trim().length >= 2 && (
            <div className="px-4 py-8 text-center">
              <FiSearch className="w-6 h-6 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">Nenhum resultado para &apos;{query.trim()}&apos;</p>
            </div>
          )}

          {/* Results */}
          {categories.map((category) => {
            const CatIcon = category.icon
            return (
              <div key={category.key} className="border-b border-subtle last:border-b-0">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-hover/50">
                  <CatIcon className="w-3.5 h-3.5 text-muted" />
                  <span className="text-xs font-semibold text-muted uppercase tracking-wide">{category.label}</span>
                </div>

                {/* Results */}
                {category.results.map((result) => {
                  flatIndex++
                  const currentFlatIndex = flatIndex
                  const isSelected = currentFlatIndex === selectedIndex
                  return (
                    <button
                      key={`${category.key}-${result.id}`}
                      onClick={() => navigateTo(result.href)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-primary/10' : 'hover:bg-surface-hover'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-main truncate">
                          <HighlightText text={result.title} query={query.trim()} />
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-muted truncate">
                            <HighlightText text={result.subtitle} query={query.trim()} />
                          </p>
                        )}
                      </div>
                      {result.badge && (
                        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${result.badge.color}`}>
                          {result.badge.label}
                        </span>
                      )}
                      <FiChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />
                    </button>
                  )
                })}

                {/* "Ver todos" link */}
                {category.hasMore && (
                  <button
                    onClick={() => {
                      // Navigate to the category's admin page
                      const firstResult = category.results[0]
                      if (firstResult) {
                        const basePath = firstResult.href.split('/').slice(0, 3).join('/')
                        navigateTo(basePath)
                      }
                    }}
                    className="w-full px-4 py-2 text-xs text-primary hover:bg-surface-hover text-left transition-colors"
                  >
                    Ver todos em {category.label}...
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
