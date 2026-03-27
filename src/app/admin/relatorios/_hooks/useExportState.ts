'use client'

import { useEffect, useState } from 'react'
import type { ActiveTab } from '../_types'

export function useExportState(activeTab: ActiveTab) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingChecklistId, setExportingChecklistId] = useState<number | null>(null)
  const [cardExportMenu, setCardExportMenu] = useState<string | null>(null)

  useEffect(() => { setExportMenuOpen(false) }, [activeTab])

  return {
    exportMenuOpen, setExportMenuOpen,
    exporting, setExporting,
    exportingPdf, setExportingPdf,
    exportingChecklistId, setExportingChecklistId,
    cardExportMenu, setCardExportMenu,
  }
}

export type ExportState = ReturnType<typeof useExportState>
