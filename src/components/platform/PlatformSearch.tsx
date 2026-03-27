'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { logError } from '@/lib/clientLogger'
import { FiSearch, FiUsers, FiHome } from 'react-icons/fi'

type SearchResult = {
  type: 'org' | 'user'
  id: string
  title: string
  subtitle: string
}

type Props = {
  onSelectOrg?: (orgId: string) => void
}

export function PlatformSearch({ onSelectOrg }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setIsOpen(false); return }
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createClient() as any
    try {
      const pattern = `%${q}%`
      const [orgs, users] = await Promise.all([
        sb.from('organizations').select('id, name, slug').or(`name.ilike.${pattern},slug.ilike.${pattern}`).limit(5),
        sb.from('users').select('id, full_name, email').or(`full_name.ilike.${pattern},email.ilike.${pattern}`).limit(5),
      ])

      const items: SearchResult[] = [
        ...(orgs.data || []).map((o: { id: string; name: string; slug: string }) => ({
          type: 'org' as const, id: o.id, title: o.name, subtitle: o.slug,
        })),
        ...(users.data || []).map((u: { id: string; full_name: string; email: string }) => ({
          type: 'user' as const, id: u.id, title: u.full_name || u.email, subtitle: u.email,
        })),
      ]
      setResults(items)
      setIsOpen(items.length > 0)
    } catch (e) { logError(e instanceof Error ? e.message : String(e)) }
    setLoading(false)
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 300)
  }

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); setQuery('') }
  }

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    if (item.type === 'org' && onSelectOrg) {
      onSelectOrg(item.id)
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-hover rounded-xl border border-subtle text-sm w-56 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
        <FiSearch className="w-3.5 h-3.5 text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar..."
          className="bg-transparent outline-none text-main placeholder-muted w-full text-sm"
        />
        {loading && (
          <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full mt-1 right-0 w-80 bg-surface rounded-xl border border-subtle shadow-xl z-50 overflow-hidden">
          {results.filter(r => r.type === 'org').length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] text-muted font-semibold uppercase bg-surface-hover">Organizacoes</div>
              {results.filter(r => r.type === 'org').map(r => (
                <button key={r.id} onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                  <FiHome className="w-4 h-4 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-main truncate">{r.title}</p>
                    <p className="text-[10px] text-muted truncate">{r.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {results.filter(r => r.type === 'user').length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] text-muted font-semibold uppercase bg-surface-hover">Usuarios</div>
              {results.filter(r => r.type === 'user').map(r => (
                <button key={r.id} onClick={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                  <FiUsers className="w-4 h-4 text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-main truncate">{r.title}</p>
                    <p className="text-[10px] text-muted truncate">{r.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
