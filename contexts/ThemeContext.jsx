'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext(null)

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme() {
  if (typeof window === 'undefined') return 'system'
  try {
    return localStorage.getItem('flowin-theme') || 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme)

  const applyTheme = useCallback((t) => {
    const resolved = t === 'system' ? getSystemTheme() : t
    document.documentElement.setAttribute('data-theme', resolved)
    document.documentElement.style.colorScheme = resolved
  }, [])

  const setTheme = useCallback((t) => {
    setThemeState(t)
    try { localStorage.setItem('flowin-theme', t) } catch {}
    applyTheme(t)
  }, [applyTheme])

  useEffect(() => {
    applyTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if (getStoredTheme() === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, applyTheme])

  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
