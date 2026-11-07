'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useAppActions } from '@/contexts/AppActionsContext'
import { subscribeToWallets } from '@/services/walletService'
import AddExpenseModal from '@/components/features/AddExpenseModal'
import AddIncomeModal from '@/components/features/AddIncomeModal'
import PurchaseAdvisorModal from '@/components/features/PurchaseAdvisorModal'

// Renders the modals opened from anywhere in the app (the "+" menu, the Today card, ...).
export default function QuickActionsHost() {
  const { user } = useUser()
  const { activeModal, modalProps, openModal, closeModal } = useAppActions()
  const [wallets, setWallets] = useState(null) // null = not loaded yet

  const needsWallets = activeModal === 'expense' || activeModal === 'income'

  useEffect(() => {
    if (!needsWallets || !user) return
    const unsub = subscribeToWallets(user.uid, setWallets)
    return () => {
      unsub()
      setWallets(null)
    }
  }, [needsWallets, user])

  if (!user || !activeModal) return null

  if (activeModal === 'purchase') {
    return (
      <PurchaseAdvisorModal
        uid={user.uid}
        onClose={closeModal}
        onBuy={(prefill) => openModal('expense', prefill)}
      />
    )
  }

  // Wallets must be known first: the modals pick their default wallet when they mount.
  if (!needsWallets || wallets === null) return null

  if (activeModal === 'expense') {
    return <AddExpenseModal key="expense" uid={user.uid} wallets={wallets} initial={modalProps} onClose={closeModal} />
  }
  if (activeModal === 'income') {
    return <AddIncomeModal key="income" uid={user.uid} wallets={wallets} onClose={closeModal} />
  }
  return null
}
