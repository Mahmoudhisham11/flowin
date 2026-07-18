'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const AppActionsContext = createContext(null)

export function AppActionsProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null)

  const openModal = useCallback((name) => setActiveModal(name), [])
  const closeModal = useCallback(() => setActiveModal(null), [])

  return (
    <AppActionsContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </AppActionsContext.Provider>
  )
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext)
  if (!ctx) throw new Error('useAppActions must be inside AppActionsProvider')
  return ctx
}
