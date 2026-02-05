'use client'

import { useState, useEffect, useCallback } from 'react'
import { APP_CONFIG } from '@/lib/config'

export type Theme = 'light' | 'dark'

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
