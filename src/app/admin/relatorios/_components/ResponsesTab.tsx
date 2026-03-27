'use client'

import { memo, useMemo } from 'react'
import Link from 'next/link'
import { FiFilter, FiEye, FiFileText, FiClock, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { Select } from '@/components/ui'
import { getStatusBadge, formatDateShort, type UserChecklist } from '../_types'
import type React from 'react'

const RESPONSE_PER_PAGE = 20

type Props = {
  userChecklists: UserChecklist[]
  responseFilterUser: string
  setResponseFilterUser: (v: string) => void
  responseFilterStore: string
  setResponseFilterStore: (v: string) => void
  responseFilterTemplate: string
  setResponseFilterTemplate: (v: string) => void
  allUsers: { id: string; name: string; email: string }[]
  allStoresSimple: { id: number; name: string }[]
  allTemplatesSimple: { id: number; name: string }[]
  responsePage: number
  setResponsePage: (p: number | ((p: number) => number)) => void
  selectedIds: Set<number>
  setSelectedIds: (v: Set<number> | ((prev: Set<number>) => Set<number>)) => void
  exportingChecklistId: number | null
  onExportChecklistPDF: (c: UserChecklist) => void
  onViewLogs: (c: UserChecklist) => void
  onExportSelectedPDF: () => void
  exportDropdownNode: React.ReactNode
}

export const ResponsesTab = memo(function ResponsesTab({
  userChecklists,
  responseFilterUser, setResponseFilterUser,
  responseFilterStore, setResponseFilterStore,
  responseFilterTemplate, setResponseFilterTemplate,
  allUsers, allStoresSimple, allTemplatesSimple,
  responsePage, setResponsePage,
  selectedIds, setSelectedIds,
  exportingChecklistId,
  onExportChecklistPDF, onViewLogs, onExportSelectedPDF,
  exportDropdownNode,
}: Props) {
  const filteredUserChecklists = useMemo(() => {
    return userChecklists.filter(c => {
      if (responseFilterUser && c.created_by !== responseFilterUser) return false
      if (responseFilterStore && c.store_name !== responseFilterStore) return false
      if (responseFilterTemplate && c.template_name !== responseFilterTemplate) return false
      return true
    })
  }, [userChecklists, responseFilterUser, responseFilterStore, responseFilterTemplate])

  const responseTotalPages = useMemo(
    () => Math.ceil(filteredUserChecklists.length / RESPONSE_PER_PAGE),
    [filteredUserChecklists.length]
  )

  const paginatedUserChecklists = useMemo(
    () => filteredUserChecklists.slice((responsePage - 1) * RESPONSE_PER_PAGE, responsePage * RESPONSE_PER_PAGE),
    [filteredUserChecklists, responsePage]
  )

  return (
    <div>
      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FiFilter className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-main">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            value={responseFilterUser}
            onChange={(v) => { setResponseFilterUser(v); setResponsePage(1) }}
            placeholder="Todos os usuarios"
            options={allUsers.map(u => ({ value: u.id, label: u.name }))}
          />
          <Select
            value={responseFilterStore}
            onChange={(v) => { setResponseFilterStore(v); setResponsePage(1) }}
            placeholder="Todas as lojas"
            options={allStoresSimple.map(s => ({ value: s.name, label: s.name }))}
          />
          <Select
            value={responseFilterTemplate}
            onChange={(v) => { setResponseFilterTemplate(v); setResponsePage(1) }}
            placeholder="Todos os checklists"
            options={allTemplatesSimple.map(t => ({ value: t.name, label: t.name }))}
          />
        </div>
      </div>

      {/* Stats + export */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted">
          {filteredUserChecklists.length} checklist(s)
          {responseFilterUser && ` de ${allUsers.find(u => u.id === responseFilterUser)?.name || 'usuario'}`}
        </p>
        {exportDropdownNode}
      </div>

      {/* Bulk export banner */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border border-primary/20 rounded-xl mb-3">
          <span className="text-sm text-primary font-medium">
            {selectedIds.size} resposta{selectedIds.size > 1 ? 's' : ''} selecionada{selectedIds.size > 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-muted hover:text-main px-3 py-1.5 rounded-lg">
              Limpar
            </button>
            <button
              onClick={onExportSelectedPDF}
              className="flex items-center gap-1.5 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90"
            >
              <FiFileText className="w-3.5 h-3.5" /> Exportar PDF{selectedIds.size > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-hover">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredUserChecklists.length > 0 && filteredUserChecklists.every(c => selectedIds.has(c.id))}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(filteredUserChecklists.map(c => c.id)) : new Set())}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Usuario</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Checklist</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Loja</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Data</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {paginatedUserChecklists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">Nenhum checklist encontrado</td>
                </tr>
              ) : paginatedUserChecklists.map(c => {
                const badge = getStatusBadge(c.status)
                return (
                  <tr key={c.id} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={e => setSelectedIds(prev => {
                          const n = new Set(prev)
                          if (e.target.checked) { n.add(c.id) } else { n.delete(c.id) }
                          return n
                        })}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-main text-sm">{c.user_name}</p>
                      <p className="text-xs text-muted">{c.user_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-main">{c.template_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-secondary">{c.store_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-muted">{formatDateShort(c.created_at)}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/checklist/${c.id}`}
                          className="p-2 text-primary hover:bg-primary/20 rounded-lg transition-colors inline-flex"
                          title="Ver respostas"
                        >
                          <FiEye className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onExportChecklistPDF(c)}
                          disabled={exportingChecklistId === c.id}
                          className="p-2 text-secondary hover:bg-primary/10 rounded-lg transition-colors inline-flex disabled:opacity-40"
                          title="Exportar PDF com fotos"
                        >
                          <FiFileText className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewLogs(c)}
                          className="p-2 text-secondary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                          title="Ver logs"
                        >
                          <FiClock className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {responseTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-subtle">
            <p className="text-sm text-muted">Pagina {responsePage} de {responseTotalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setResponsePage(p => Math.max(1, p - 1))}
                disabled={responsePage === 1}
                className="btn-ghost p-2 disabled:opacity-50"
              >
                <FiChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setResponsePage(p => Math.min(responseTotalPages, p + 1))}
                disabled={responsePage === responseTotalPages}
                className="btn-ghost p-2 disabled:opacity-50"
              >
                <FiChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

