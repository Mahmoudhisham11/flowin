'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DayIcon, PlanIcon, GoalIcon, InsightsIcon } from '@/components/Icons'
import { useTranslation } from '@/hooks/useTranslation'
import PlusMenu from './PlusMenu'
import styles from './BottomNav.module.css'

// Today, Plan | quick add | Goals, Insights. Everything else lives in the quick-add menu.
const leftItems = [
  { key: 'nav.today', icon: <DayIcon />, route: '/' },
  { key: 'nav.plan', icon: <PlanIcon />, route: '/budget' },
]
const rightItems = [
  { key: 'nav.goals', icon: <GoalIcon />, route: '/goals' },
  { key: 'nav.insights', icon: <InsightsIcon />, route: '/report' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  const renderTab = (item) => {
    const active = item.route === pathname
    return (
      <button
        key={item.key}
        type="button"
        className={`${styles.tab} ${active ? styles.tabActive : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => router.push(item.route)}
      >
        <span className={styles.tabIcon}>{item.icon}</span>
        <span className={styles.tabLabel}>{t(item.key)}</span>
      </button>
    )
  }

  return (
    <>
      <nav className={styles.nav} aria-label="Main">
        <div className={styles.inner}>
          {leftItems.map(renderTab)}

          <div className={styles.centerWrap}>
            <button
              type="button"
              className={`${styles.fab} ${menuOpen ? styles.fabActive : ''}`}
              aria-label={t('quick.title')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg className={`${styles.fabIcon} ${menuOpen ? styles.fabIconRotated : ''}`} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {rightItems.map(renderTab)}
        </div>
      </nav>

      <PlusMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
