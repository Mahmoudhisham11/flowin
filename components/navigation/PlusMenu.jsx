'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useUser } from '@/contexts/UserContext'
import { useAppActions } from '@/contexts/AppActionsContext'
import { BudgetIcon, AIIcon, SettingsIcon, AdminIcon, TaskIcon } from '@/components/Icons'
import styles from './PlusMenu.module.css'

const getItems = (isAdmin) => {
  const items = [
    { id: 'expense', key: 'quick.expense', icon: <span>💸</span>, modal: 'expense' },
    { id: 'income', key: 'quick.income', icon: <span>💰</span>, modal: 'income' },
    { id: 'purchase', key: 'quick.purchase', icon: <span>🛒</span>, modal: 'purchase' },
    { id: 'budget', key: 'nav.budget', icon: <BudgetIcon />, route: '/budget' },
    { id: 'tasks', key: 'nav.dailyTasks', icon: <TaskIcon />, route: '/tasks' },
    { id: 'ai', key: 'nav.aiAssistant', icon: <AIIcon />, route: '/ai' },
    { id: 'settings', key: 'nav.settings', icon: <SettingsIcon />, route: '/settings' },
  ]
  if (isAdmin) {
    items.splice(3, 0, { id: 'admin', key: 'nav.admin', icon: <AdminIcon />, route: '/admin' })
  }
  return items
}

export default function PlusMenu({ open, onClose }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { userData } = useUser()
  const { openModal } = useAppActions()
  const isAdmin = userData?.role === 'admin'
  const items = getItems(isAdmin)

  const handleClick = (item) => {
    if (item.modal) openModal(item.modal)
    else router.push(item.route)
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
      />
      <div className={styles.menu}>
        {items.map((item, i) => (
          <button
            key={item.id}
            className={styles.menuItem}
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => handleClick(item)}
          >
            <span className={styles.menuIcon}>{item.icon}</span>
            <span className={styles.menuLabel}>{t(item.key)}</span>
          </button>
        ))}
      </div>
    </>
  )
}
