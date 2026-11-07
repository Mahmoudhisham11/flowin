'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const AppActionsContext = createContext(null)

export function AppActionsProvider({ children }) {
  const [activeModal, setActiveModal] = useState(null)
  const [modalProps, setModalProps] = useState({})

  // openModal('expense', { amount: 120, reason: 'Headphones' }) opens a global modal with optional prefill.
  const openModal = useCallback((name, props = {}) => {
    setModalProps(props)
    setActiveModal(name)
  }, [])
  const closeModal = useCallback(() => {
    setActiveModal(null)
    setModalProps({})
  }, [])

  return (
    <AppActionsContext.Provider value={{ activeModal, modalProps, openModal, closeModal }}>
      {children}
    </AppActionsContext.Provider>
  )
}

export function useAppActions() {
  const ctx = useContext(AppActionsContext)
  if (!ctx) throw new Error('useAppActions must be inside AppActionsProvider')
  return ctx
}
