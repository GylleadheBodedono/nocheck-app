'use client'

import { useState, useEffect, useCallback } from 'react'
import { APP_CONFIG } from '@/lib/config'

/** Valores de tema suportados pelo OpereCheck. */
export type Theme = 'light' | 'dark'

/**
 * Hook para gerenciar o tema visual (claro/escuro) da aplicação.
 *
 * Comportamento:
 * - Inicializa com o valor salvo no `localStorage` (chave definida em `APP_CONFIG`)
 * - Se não houver preferência salva, detecta a preferência do sistema via `matchMedia`
 * - Atualiza automaticamente quando o sistema muda de tema (apenas se o usuário não fixou um)
 * - Persiste a escolha manual do usuário no `localStorage` e aplica via `data-theme` no `<html>`
 *
 * @returns `{ theme, setTheme, toggleTheme, mounted, isDark, isLight }`
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Inicializa o tema do localStorage ou preferencia do sistema
  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(APP_CONFIG.storage.themeKey) as Theme | null

    if (stored) {
      setThemeState(stored)
      document.documentElement.setAttribute('data-theme', stored)
    } else {
      // Verifica preferencia do sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const defaultTheme = prefersDark ? 'dark' : 'light'
      setThemeState(defaultTheme)
      document.documentElement.setAttribute('data-theme', defaultTheme)
    }
  }, [])

  // Listener para mudancas na preferencia do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem(APP_CONFIG.storage.themeKey)
      // So muda automaticamente se o usuario nao tiver escolhido manualmente
      if (!stored) {
        const newTheme = e.matches ? 'dark' : 'light'
        setThemeState(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(APP_CONFIG.storage.themeKey, newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }, [theme, setTheme])

  return {
    theme,
    setTheme,
    toggleTheme,
    mounted,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  }
}
