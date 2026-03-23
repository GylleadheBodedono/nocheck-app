'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, PageContainer } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'
import {
  FiImage,
  FiSearch,
  FiTrash2,
  FiUpload,
  FiFolder,
  FiX,
  FiDownload,
  FiCheckSquare,
  FiSquare,
  FiCalendar,
  FiFilter,
  FiCopy,
} from 'react-icons/fi'

type StorageFile = {
  name: string
  created_at: string
  size: number
  publicUrl: string
  path: string
}

type Folder = 'uploads' | 'anexos'

const ITEMS_PER_PAGE = 24

export default function GaleriaPage() {
  const [loading, setLoading] = useState(true)
  const [files, setFiles] = useState<StorageFile[]>([])
  const [currentFolder, setCurrentFolder] = useState<Folder>('uploads')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<StorageFile | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [operationLoading, setOperationLoading] = useState(false)
  const uploadRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { refreshKey } = useRealtimeRefresh(['checklist_responses'])

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }

      let isAdmin = false
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single()
          isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
        }
      } catch {
        try {
          const cachedAuth = await getAuthCache()
          if (cachedAuth) {
            const cachedUser = await getUserCache(cachedAuth.userId)
            isAdmin = cachedUser?.is_admin || false
          }
        } catch { /* ignore */ }
      }

      if (!isAdmin) {
        router.push(APP_CONFIG.routes.dashboard)
        return
      }

      setLoading(false)
    }
    checkAuth()
  }, [supabase, router])

  const fetchFiles = useCallback(async (folder: Folder) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/storage?folder=${folder}`)
      const data = await res.json()
      if (data.success) {
        setFiles(data.files)
      } else {
        setFiles([])
      }
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFiles(currentFolder)
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setVisibleCount(ITEMS_PER_PAGE)
    setSelectedPaths(new Set())
  }, [currentFolder, fetchFiles])

  useEffect(() => {
    if (refreshKey > 0 && navigator.onLine) fetchFiles(currentFolder)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const switchFolder = (folder: Folder) => {
    if (folder !== currentFolder) {
      setCurrentFolder(folder)
    }
  }

  // Filtered files: search + date range
  const filteredFiles = useMemo(() => {
    let result = files

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
    }

    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      result = result.filter(f => new Date(f.created_at) >= from)
    }

    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      result = result.filter(f => new Date(f.created_at) <= to)
    }

    return result
  }, [files, search, dateFrom, dateTo])

  const visibleFiles = filteredFiles.slice(0, visibleCount)
  const hasActiveFilters = search || dateFrom || dateTo
  const selectionCount = selectedPaths.size

  // Selection helpers
  const toggleSelect = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const allVisibleSelected = visibleFiles.length > 0 && visibleFiles.every(f => selectedPaths.has(f.path))

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedPaths(new Set())
    } else {
      setSelectedPaths(new Set(filteredFiles.map(f => f.path)))
    }
  }

  const clearSelection = () => setSelectedPaths(new Set())

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectionCount === 0) return
    if (!window.confirm(`Deletar ${selectionCount} arquivo(s)? Esta acao nao pode ser desfeita.`)) return

    setDeleting(true)
    try {
      const paths = [...selectedPaths]
      const res = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths }),
      })
      const data = await res.json()
      if (data.success) {
        setFiles(prev => prev.filter(f => !selectedPaths.has(f.path)))
        setSelectedPaths(new Set())
      }
    } catch { /* ignore */ }
    setDeleting(false)
  }

  // Single delete
  const handleDelete = async (file: StorageFile) => {
    if (!window.confirm(`Deletar "${file.name}"? Esta acao nao pode ser desfeita.`)) return

    setDeleting(true)
    try {
      const res = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: [file.path] }),
      })
      const data = await res.json()
      if (data.success) {
        setFiles(prev => prev.filter(f => f.path !== file.path))
        setSelectedPaths(prev => { const n = new Set(prev); n.delete(file.path); return n })
      }
    } catch { /* ignore */ }
    setDeleting(false)
  }

  // Bulk download
  const handleBulkDownload = async () => {
    if (selectionCount === 0) return
    setOperationLoading(true)

    const selected = files.filter(f => selectedPaths.has(f.path))
    for (const file of selected) {
      try {
        const response = await fetch(file.publicUrl)
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        // Small delay between downloads to not overwhelm browser
        if (selected.length > 1) await new Promise(r => setTimeout(r, 300))
      } catch {
        console.error(`[Galeria] Erro ao baixar: ${file.name}`)
      }
    }
    setOperationLoading(false)
  }

  // Copy URLs
  const handleCopyUrls = () => {
    const selected = files.filter(f => selectedPaths.has(f.path))
    const urls = selected.map(f => f.publicUrl).join('\n')
    navigator.clipboard.writeText(urls).then(() => {
      alert(`${selected.length} URL(s) copiada(s) para a area de transferencia!`)
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = urls
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      alert(`${selected.length} URL(s) copiada(s)!`)
    })
  }

  // Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files
    if (!uploadFiles || uploadFiles.length === 0) return

    setUploading(true)
    for (let fi = 0; fi < uploadFiles.length; fi++) {
      const file = uploadFiles[fi]
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
        })

        const fileName = `galeria_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, fileName, folder: currentFolder }),
        })
      } catch { /* ignore */ }
    }
    await fetchFiles(currentFolder)
    setUploading(false)
    if (uploadRef.current) uploadRef.current.value = ''
  }

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading && files.length === 0) {
    return <LoadingPage />
  }

  return (
    <>
      <PageContainer className="!py-6">
        {/* Folder tabs */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => switchFolder('uploads')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all border-2 ${
              currentFolder === 'uploads'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-subtle text-secondary hover:border-primary/50'
            }`}
          >
            <FiFolder className="w-5 h-5" />
            <span>Uploads</span>
            <span className="text-xs opacity-60">(fotos)</span>
          </button>
          <button
            onClick={() => switchFolder('anexos')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all border-2 ${
              currentFolder === 'anexos'
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-subtle text-secondary hover:border-primary/50'
            }`}
          >
            <FiFolder className="w-5 h-5" />
            <span>Anexos</span>
            <span className="text-xs opacity-60">(sim/nao/n/a)</span>
          </button>
        </div>

        {/* Search + Filters + Upload */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome..."
              className="input w-full pl-11 pr-4 py-3 rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-main">
                <FiX className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl flex items-center gap-2 border-2 transition-all ${
              showFilters || dateFrom || dateTo
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-surface border-subtle text-secondary hover:border-primary/50'
            }`}
          >
            <FiFilter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            disabled={uploading}
            className="btn-primary px-5 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="hidden sm:inline">Enviando...</span>
              </>
            ) : (
              <>
                <FiUpload className="w-4 h-4" />
                <span className="hidden sm:inline">Importar</span>
              </>
            )}
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
        </div>

        {/* Date filters (collapsible) */}
        {showFilters && (
          <div className="card p-4 mb-4 flex flex-wrap items-end gap-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <FiCalendar className="w-4 h-4" />
              <span>Periodo:</span>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted block mb-1">De</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs text-muted block mb-1">Ate</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-primary hover:underline pb-1">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Selection toolbar */}
        {selectionCount > 0 && (
          <div className="card p-3 mb-4 flex items-center justify-between bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <button onClick={clearSelection} className="p-1.5 text-muted hover:text-main rounded-lg hover:bg-surface">
                <FiX className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-primary">{selectionCount} selecionado(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyUrls}
                disabled={operationLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface transition-colors"
                title="Copiar URLs"
              >
                <FiCopy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copiar URLs</span>
              </button>
              <button
                onClick={handleBulkDownload}
                disabled={operationLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-secondary hover:bg-surface transition-colors disabled:opacity-50"
                title="Baixar selecionados"
              >
                {operationLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiDownload className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Baixar</span>
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                title="Deletar selecionados"
              >
                {deleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FiTrash2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Deletar</span>
              </button>
            </div>
          </div>
        )}

        {/* Select all + count */}
        {!loading && filteredFiles.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors"
            >
              {allVisibleSelected ? <FiCheckSquare className="w-4 h-4 text-primary" /> : <FiSquare className="w-4 h-4" />}
              <span>{allVisibleSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
            </button>
            <p className="text-sm text-muted">
              {filteredFiles.length} foto(s){hasActiveFilters ? ' (filtrado)' : ''}
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredFiles.length === 0 && (
          <div className="card p-12 text-center">
            <FiImage className="w-16 h-16 text-muted mx-auto mb-4" />
            <p className="text-secondary text-lg font-medium">
              {hasActiveFilters ? 'Nenhuma foto encontrada' : 'Pasta vazia'}
            </p>
            <p className="text-muted text-sm mt-1">
              {hasActiveFilters ? 'Tente ajustar os filtros' : `Nenhuma foto na pasta ${currentFolder}`}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-primary text-sm hover:underline">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        {/* Photo grid */}
        {!loading && visibleFiles.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {visibleFiles.map((file) => {
              const isSelected = selectedPaths.has(file.path)
              return (
                <div key={file.path} className={`card overflow-hidden group relative ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  {/* Selection checkbox */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(file.path) }}
                    className={`absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-primary text-white'
                        : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected ? <FiCheckSquare className="w-4 h-4" /> : <FiSquare className="w-4 h-4" />}
                  </button>

                  {/* Thumbnail */}
                  <GaleriaThumbnail file={file} onClick={() => setPreview(file)} />

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs text-main font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    {(() => {
                      const subPath = file.path.replace(/^(uploads|anexos)\//, '').replace(`/${file.name}`, '')
                      return subPath ? (
                        <p className="text-[10px] text-muted truncate" title={subPath}>{subPath}</p>
                      ) : null
                    })()}
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-muted">
                        <span>{formatSize(file.size)}</span>
                        <span className="mx-1">·</span>
                        <span>{formatDate(file.created_at)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(file)}
                        disabled={deleting}
                        className="p-1 text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors disabled:opacity-50"
                        title="Deletar"
                      >
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Load more + count */}
        {!loading && filteredFiles.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-sm text-muted">
            <p>Mostrando {Math.min(visibleCount, filteredFiles.length)} de {filteredFiles.length} fotos</p>
            {visibleCount < filteredFiles.length && (
              <button
                onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                className="btn-secondary px-4 py-2 rounded-lg"
              >
                Carregar mais
              </button>
            )}
          </div>
        )}
      </PageContainer>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 z-10 p-2 bg-surface rounded-full shadow-lg text-main hover:text-red-400 transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.publicUrl}
              alt={preview.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
            <div className="mt-3 flex items-center justify-between bg-surface rounded-xl p-3">
              <div>
                <p className="text-main font-medium">{preview.name}</p>
                <p className="text-muted text-sm">{formatSize(preview.size)} · {formatDate(preview.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={preview.publicUrl}
                  download={preview.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
                >
                  <FiDownload className="w-4 h-4" />
                  Baixar
                </a>
                <button
                  onClick={() => { handleDelete(preview); setPreview(null) }}
                  className="btn-secondary px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 flex items-center gap-2 text-sm"
                >
                  <FiTrash2 className="w-4 h-4" />
                  Deletar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function GaleriaThumbnail({ file, onClick }: { file: StorageFile; onClick: () => void }) {
  const [error, setError] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full aspect-square bg-surface relative overflow-hidden"
    >
      {error ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <FiImage className="w-8 h-8 text-muted" />
          <span className="text-[10px] text-muted">Erro ao carregar</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.publicUrl}
          alt={file.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
    </button>
  )
}
