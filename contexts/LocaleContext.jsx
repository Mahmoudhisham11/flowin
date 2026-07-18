'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { setCurrentLang } from '@/lib/translations'

const LocaleContext = createContext(null)

function getStoredLang() {
  if (typeof window === 'undefined') return 'en'
  try {
    return localStorage.getItem('flowin-lang') || 'en'
  } catch {
    return 'en'
  }
}

export function LocaleProvider({ children }) {
  const [lang, setLangState] = useState(getStoredLang)

  const applyLang = useCallback((l) => {
    document.documentElement.setAttribute('lang', l === 'ar' ? 'ar' : 'en')
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr')
    document.documentElement.classList.toggle('rtl', l === 'ar')
    setCurrentLang(l)
  }, [])

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem('flowin-lang', l) } catch {}
    applyLang(l)
  }, [applyLang])

  useEffect(() => {
    applyLang(lang)
  }, [lang, applyLang])

  return (
    <LocaleContext.Provider value={{ lang, setLang }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be inside LocaleProvider')
  return ctx
}
