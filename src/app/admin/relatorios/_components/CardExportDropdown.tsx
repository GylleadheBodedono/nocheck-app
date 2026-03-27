'use client'

import { memo } from 'react'
import { FiDownload } from 'react-icons/fi'

type Props = {
  cardType: 'template' | 'store' | 'user'
  isOpen: boolean
  onToggle: () => void
  canExportExcel: boolean
  canExportPdf: boolean
  onExport: (format: 'csv' | 'txt' | 'xlsx' | 'pdf') => void
}

/**
 * Per-card export dropdown for the three adherence tables.
 * Extracted as a module-level component (not defined inside the page) so React
 * does not unmount/remount it on every parent render.
 */
export const CardExportDropdown = memo(function CardExportDropdown({
  isOpen, onToggle, canExportExcel, canExportPdf, onExport,
}: Props) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors"
        title="Exportar esta tabela"
      >
        <FiDownload className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[120px]">
          <button onClick={() => onExport('csv')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-t-lg">CSV</button>
          {canExportExcel ? (
            <button onClick={() => onExport('xlsx')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">Excel</button>
          ) : (
            <span className="w-full px-4 py-2 text-sm text-left text-muted block cursor-not-allowed" title="Disponivel no plano Professional">Excel (Pro)</span>
          )}
          <button onClick={() => onExport('txt')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">TXT</button>
          {canExportPdf ? (
            <button onClick={() => onExport('pdf')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-b-lg">PDF</button>
          ) : (
            <span className="w-full px-4 py-2 text-sm text-left text-muted block cursor-not-allowed rounded-b-lg" title="Disponivel no plano Professional">PDF (Pro)</span>
          )}
        </div>
      )}
    </div>
  )
})
