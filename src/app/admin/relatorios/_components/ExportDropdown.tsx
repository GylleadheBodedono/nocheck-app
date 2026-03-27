'use client'

import { memo } from 'react'
import { FiDownload, FiChevronDown } from 'react-icons/fi'

type Props = {
  exporting: boolean
  exportingPdf: boolean
  isOpen: boolean
  onToggle: () => void
  onExport: (format: 'csv' | 'txt' | 'xlsx') => void
  onExportPdf: () => void
}

/**
 * Top-level export dropdown shared across all four tabs.
 * Converted from an inline JSX variable (re-evaluated every render) to a proper
 * memoized component that only re-renders when its own props change.
 */
export const ExportDropdown = memo(function ExportDropdown({
  exporting, exportingPdf, isOpen, onToggle, onExport, onExportPdf,
}: Props) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={exporting || exportingPdf}
        className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50"
      >
        <FiDownload className="text-base" />
        {exportingPdf ? 'Gerando PDF...' : exporting ? 'Exportando...' : 'Exportar'}
        <FiChevronDown className="text-xs" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg z-20 min-w-[160px]">
          <button onClick={() => onExport('csv')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-t-lg">CSV</button>
          <button onClick={() => onExport('xlsx')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">Excel</button>
          <button onClick={() => onExport('txt')} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover">TXT</button>
          <button onClick={onExportPdf} disabled={exportingPdf} className="w-full px-4 py-2 text-sm text-left text-main hover:bg-surface-hover rounded-b-lg disabled:opacity-50">
            {exportingPdf ? 'Gerando PDF...' : 'PDF'}
          </button>
        </div>
      )}
    </div>
  )
})
