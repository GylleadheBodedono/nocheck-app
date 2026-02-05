'use client'

import { useTheme } from '@/hooks/useTheme'
import { FiSun, FiMoon } from 'react-icons/fi'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme()

  // Evita flash de conteudo incorreto
  if (!mounted) {
    return (
      <button
        className={`p-2 rounded-xl bg-surface-hover ${className}`}
        disabled
      >
        <div className="w-5 h-5" />
      </button>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-secondary hover:bg-surface-hover hover:text-main transition-all duration-200 ${className}`}
      title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
    >
      {theme === 'light' ? (
        <FiMoon className="w-5 h-5" />
      ) : (
        <FiSun className="w-5 h-5" />
      )}
    </button>
  )
}
