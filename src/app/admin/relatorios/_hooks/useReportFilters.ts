'use client'

import { useState } from 'react'
import type { Period } from '../_types'

export function useReportFilters() {
  const [period, setPeriod] = useState<Period>('30d')
  const [overviewFilterStore, setOverviewFilterStore] = useState('')
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set())
  const [hiddenStoreIds, setHiddenStoreIds] = useState<Set<number>>(new Set())
  const [hiddenTemplateIds, setHiddenTemplateIds] = useState<Set<number>>(new Set())
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [templateSort, setTemplateSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [storeSort, setStoreSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [userSort, setUserSort] = useState<'best' | 'worst' | 'name'>('worst')
  const [showAllGaps, setShowAllGaps] = useState(false)
  const [responsePage, setResponsePage] = useState(1)
  const [responseFilterUser, setResponseFilterUser] = useState('')
  const [responseFilterStore, setResponseFilterStore] = useState('')
  const [responseFilterTemplate, setResponseFilterTemplate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  return {
    period, setPeriod,
    overviewFilterStore, setOverviewFilterStore,
    hiddenUserIds, setHiddenUserIds,
    hiddenStoreIds, setHiddenStoreIds,
    hiddenTemplateIds, setHiddenTemplateIds,
    showAdvancedFilters, setShowAdvancedFilters,
    templateSort, setTemplateSort,
    storeSort, setStoreSort,
    userSort, setUserSort,
    showAllGaps, setShowAllGaps,
    responsePage, setResponsePage,
    responseFilterUser, setResponseFilterUser,
    responseFilterStore, setResponseFilterStore,
    responseFilterTemplate, setResponseFilterTemplate,
    selectedIds, setSelectedIds,
  }
}

export type ReportFilters = ReturnType<typeof useReportFilters>
