'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  FiShuffle, FiX, FiSearch,
  FiBox, FiPackage, FiClipboard, FiFileText, FiFile, FiFolder,
  FiCamera, FiImage, FiHash, FiType, FiEdit3, FiPenTool,
  FiCheckSquare, FiCheckCircle, FiList, FiGrid, FiLayers,
  FiCalendar, FiClock, FiStar, FiHeart, FiThumbsUp,
  FiAlertTriangle, FiAlertCircle, FiInfo, FiHelpCircle,
  FiTruck, FiShoppingCart, FiDollarSign, FiPercent,
  FiBarChart2, FiTrendingUp, FiActivity, FiThermometer,
  FiMapPin, FiNavigation, FiCompass,
  FiUsers, FiUser, FiUserCheck,
  FiShield, FiLock, FiKey, FiEye,
  FiTag, FiBookmark, FiFlag, FiAward,
  FiTool, FiSettings, FiSliders,
  FiZap, FiBell, FiSend,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

export const ICON_MAP: Record<string, IconType> = {
  FiBox, FiPackage, FiClipboard, FiFileText, FiFile, FiFolder,
  FiCamera, FiImage, FiHash, FiType, FiEdit3, FiPenTool,
  FiCheckSquare, FiCheckCircle, FiList, FiGrid, FiLayers,
  FiCalendar, FiClock, FiStar, FiHeart, FiThumbsUp,
  FiAlertTriangle, FiAlertCircle, FiInfo, FiHelpCircle,
  FiTruck, FiShoppingCart, FiDollarSign, FiPercent,
  FiBarChart2, FiTrendingUp, FiActivity, FiThermometer,
  FiMapPin, FiNavigation, FiCompass,
  FiUsers, FiUser, FiUserCheck,
  FiShield, FiLock, FiKey, FiEye,
  FiTag, FiBookmark, FiFlag, FiAward,
  FiTool, FiSettings, FiSliders,
  FiZap, FiBell, FiSend,
}

const ICON_NAMES = Object.keys(ICON_MAP)

function iconToLabel(name: string): string {
  // FiBarChart2 → "Bar Chart 2"
  return name.replace(/^Fi/, '').replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').trim()
}

type IconPickerProps = {
  value: string | null
  onChange: (icon: string | null) => void
  fallback: React.ReactNode
}

export function IconPicker({ value, onChange, fallback }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const [openUp, setOpenUp] = useState(false)

  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const filtered = search
    ? ICON_NAMES.filter(n => iconToLabel(n).toLowerCase().includes(search.toLowerCase()))
    : ICON_NAMES

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    // Check if should open upward
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setOpenUp(rect.bottom + 280 > window.innerHeight)
    setOpen(!open)
    setSearch('')
  }

  const handleSelect = (iconName: string) => {
    onChange(iconName)
    setOpen(false)
    setSearch('')
  }

  const handleRandom = (e: React.MouseEvent) => {
    e.stopPropagation()
    const randomIcon = ICON_NAMES[Math.floor(Math.random() * ICON_NAMES.length)]
    onChange(randomIcon)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setOpen(false)
    setSearch('')
  }

  const SelectedIcon = value ? ICON_MAP[value] : null

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={handleOpen}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg border flex items-center justify-center text-sm shrink-0 cursor-pointer transition-all ${
          open
            ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
            : 'border-subtle bg-surface-hover hover:border-primary/50'
        }`}
        title="Escolher icone"
      >
        {SelectedIcon ? (
          <SelectedIcon className="w-4 h-4 text-primary" />
        ) : (
          fallback
        )}
      </button>

      {open && (
        <div
          className={`absolute ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-50 w-64 bg-surface border border-subtle rounded-xl shadow-theme-lg p-2 space-y-2`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search + actions */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-surface-hover border border-subtle rounded-lg text-main placeholder:text-muted focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleRandom}
              className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
              title="Aleatorio"
            >
              <FiShuffle className="w-3.5 h-3.5" />
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                title="Remover icone"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1 max-h-44 overflow-y-auto">
            {filtered.map((name) => {
              const Icon = ICON_MAP[name]
              const isSelected = value === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(name)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted hover:bg-surface-hover hover:text-main'
                  }`}
                  title={iconToLabel(name)}
                >
                  <Icon className="w-4 h-4" />
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="col-span-7 text-center text-xs text-muted py-4">Nenhum icone encontrado</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
