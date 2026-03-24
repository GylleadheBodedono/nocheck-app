'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { FiChevronDown, FiCheck } from 'react-icons/fi'

// ============================================
// TYPES
// ============================================

/** Par valor/rótulo para as opções do `Select`. */
export type SelectOption = {
  value: string
  label: string
}

export type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  /** Text shown in trigger when value is empty — also shown as first option in dropdown */
  placeholder?: string
  disabled?: boolean
  /** Extra classes applied to the trigger button (width, text-size, etc.) */
  className?: string
  title?: string
}

// ============================================
// COMPONENT
// ============================================

/**
 * Select customizado com dropdown acessível via teclado.
 * Substitui o `<select>` nativo para manter consistência visual com o design system.
 *
 * Suporta navegação por teclado (setas ↑↓, Enter para selecionar, Escape para fechar)
 * e fecha automaticamente ao clicar fora do componente.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className = '',
  title,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  const close = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [])

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, close])

  // Scroll focused item into view
  useEffect(() => {
    if (!isOpen || focusedIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-option]')
    items[focusedIndex]?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, isOpen])

  const handleSelect = (optValue: string) => {
    onChange(optValue)
    close()
  }

  const open = () => {
    if (disabled) return
    const startIndex = placeholder
      ? options.findIndex(o => o.value === value)
      : options.findIndex(o => o.value === value)
    setFocusedIndex(startIndex >= 0 ? startIndex : 0)
    setIsOpen(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    // Total items = placeholder item (if any) + options
    const total = (placeholder ? 1 : 0) + options.length

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!isOpen) {
          open()
        } else {
          // focusedIndex: 0 = placeholder (if present), 1..n = options
          if (placeholder) {
            if (focusedIndex === 0) handleSelect('')
            else if (focusedIndex > 0) handleSelect(options[focusedIndex - 1].value)
          } else {
            if (focusedIndex >= 0) handleSelect(options[focusedIndex].value)
          }
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) { open(); return }
        setFocusedIndex(prev => (prev < total - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        if (!isOpen) { open(); return }
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : total - 1))
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        close()
        break
    }
  }

  // Displayed label in trigger
  const triggerLabel = selectedOption?.label ?? placeholder ?? ''
  const isEmpty = !selectedOption

  return (
    <div ref={containerRef} className="relative" title={title}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`input w-full flex items-center justify-between gap-2 text-left cursor-pointer select-none transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${isEmpty ? 'text-muted' : 'text-main'} ${className}`}
      >
        <span className="flex-1 truncate text-inherit">{triggerLabel}</span>
        <FiChevronDown
          className={`w-4 h-4 shrink-0 text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-subtle shadow-theme-lg bg-surface overflow-hidden"
          style={{ animation: 'selectFadeIn 0.12s ease-out' }}
        >
          <div ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {/* Placeholder option (acts as "clear" / no selection) */}
            {placeholder && (
              <button
                data-option
                type="button"
                role="option"
                aria-selected={isEmpty}
                onMouseDown={(e) => { e.preventDefault(); handleSelect('') }}
                onMouseEnter={() => setFocusedIndex(0)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  focusedIndex === 0 ? 'bg-primary/10' : 'hover:bg-surface-hover'
                } ${isEmpty ? 'text-primary font-medium' : 'text-muted'}`}
              >
                <span className="flex-1 truncate">{placeholder}</span>
                {isEmpty && <FiCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            )}

            {/* Options */}
            {options.map((opt, idx) => {
              const listIdx = placeholder ? idx + 1 : idx
              const isSelected = opt.value === value
              const isFocused = focusedIndex === listIdx
              return (
                <button
                  data-option
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value) }}
                  onMouseEnter={() => setFocusedIndex(listIdx)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    isFocused ? 'bg-primary/10' : 'hover:bg-surface-hover'
                  } ${isSelected ? 'text-primary font-medium' : 'text-main'}`}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isSelected && <FiCheck className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              )
            })}

            {options.length === 0 && !placeholder && (
              <p className="px-3 py-2 text-sm text-muted">Nenhuma opcao disponivel</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes selectFadeIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>
    </div>
  )
}
