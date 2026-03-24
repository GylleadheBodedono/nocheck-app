import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'

const THEME_KEY = 'nocheck-theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('useTheme', () => {
  describe('inicialização', () => {
    it('usa tema salvo no localStorage', async () => {
      localStorage.setItem(THEME_KEY, 'dark')
      const { result } = renderHook(() => useTheme())
      // aguarda o useEffect de inicialização
      await act(async () => {})
      expect(result.current.theme).toBe('dark')
      expect(result.current.isDark).toBe(true)
    })

    it('usa tema claro quando nao ha preferencia salva e sistema e claro', async () => {
      // happy-dom: matchMedia retorna false para prefers-color-scheme por padrão
      const { result } = renderHook(() => useTheme())
      await act(async () => {})
      expect(result.current.theme).toBe('light')
      expect(result.current.isLight).toBe(true)
    })

    it('define mounted=true apos montagem', async () => {
      const { result } = renderHook(() => useTheme())
      await act(async () => {})
      expect(result.current.mounted).toBe(true)
    })
  })

  describe('setTheme', () => {
    it('muda o tema e persiste no localStorage', async () => {
      const { result } = renderHook(() => useTheme())
      await act(async () => {})

      act(() => result.current.setTheme('dark'))

      expect(result.current.theme).toBe('dark')
      expect(localStorage.getItem(THEME_KEY)).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    })
  })

  describe('toggleTheme', () => {
    it('alterna entre light e dark', async () => {
      localStorage.setItem(THEME_KEY, 'light')
      const { result } = renderHook(() => useTheme())
      await act(async () => {})

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe('dark')

      act(() => result.current.toggleTheme())
      expect(result.current.theme).toBe('light')
    })
  })

  describe('data-theme no documento', () => {
    it('aplica data-theme ao <html> ao mudar tema', async () => {
      const { result } = renderHook(() => useTheme())
      await act(async () => {})

      act(() => result.current.setTheme('dark'))
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

      act(() => result.current.setTheme('light'))
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    })
  })
})
