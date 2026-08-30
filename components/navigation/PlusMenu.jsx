'use client'

import { useRouter } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import { useUser } from '@/contexts/UserContext'
import { BudgetIcon, AIIcon, SettingsIcon, AdminIcon, TaskIcon } from '@/components/Icons'
import styles from './PlusMenu.module.css'

const getItems = (isAdmin) => {
  const items = [
    { id: 'budget', key: 'nav.budget', icon: <BudgetIcon />, route: '/budget' },
    { id: 'tasks', key: 'nav.dailyTasks', icon: <TaskIcon />, route: '/tasks' },
    { id: 'ai', key: 'nav.aiAssistant', icon: <AIIcon />, route: '/ai' },
    { id: 'settings', key: 'nav.settings', icon: <SettingsIcon />, route: '/settings' },
  ]
  if (isAdmin) {
    items.unshift({ id: 'admin', key: 'nav.admin', icon: <AdminIcon />, route: '/admin' })
  }
  return items
}

export default function PlusMenu({ open, onClose }) {
  const router = useRouter()
  const { t } = useTranslation()
  const { userData } = useUser()
  const isAdmin = userData?.role === 'admin'
  const items = getItems(isAdmin)

  const handleClick = (item) => {
    router.push(item.route)
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
