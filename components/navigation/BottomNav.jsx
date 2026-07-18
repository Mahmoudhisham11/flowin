'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { DashboardIcon, BudgetIcon, ReportIcon, GoalIcon } from '@/components/Icons'
import { useTranslation } from '@/hooks/useTranslation'
import PlusMenu from './PlusMenu'
import styles from './BottomNav.module.css'

const navItems = [
  { key: 'nav.dashboard', icon: <DashboardIcon />, route: '/' },
  { key: 'nav.budget', icon: <BudgetIcon />, route: '/budget' },
  { key: 'nav.goals', icon: <GoalIcon />, route: '/goals' },
  { key: 'nav.reports', icon: <ReportIcon />, route: '/analytics' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)

  const activeIndex = navItems.findIndex((item) => item.route === pathname)

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.inner}>
          {navItems.map((item, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={item.key}
                className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                onClick={() => router.push(item.route)}
              >
                {isActive && <div className={styles.pill} />}
                <span className={`${styles.tabIcon} ${isActive ? styles.tabIconActive : ''}`}>
                  {item.icon}
                </span>
                {isActive && (
                  <span className={styles.tabLabel}>
                    {t(item.key)}
                  </span>
                )}
              </button>
            )
          })}

          <div className={styles.centerWrap}>
            <button
              className={`${styles.fab} ${menuOpen ? styles.fabActive : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg
                className={`${styles.fabIcon} ${menuOpen ? styles.fabIconRotated : ''}`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <PlusMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
