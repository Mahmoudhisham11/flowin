'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useTranslation } from '@/hooks/useTranslation'
import {
  DashboardIcon, ReportIcon,
  BudgetIcon, AIIcon, SettingsIcon, DebtIcon, AdminIcon, GoalIcon, TaskIcon, ProjectIcon
} from '@/components/Icons'
import styles from './Sidebar.module.css'

const mainNav = [
  { key: 'nav.dashboard', icon: <DashboardIcon />, route: '/' },
  { key: 'nav.budget', icon: <BudgetIcon />, route: '/budget' },
  { key: 'nav.reports', icon: <ReportIcon />, route: '/analytics' },
]

const getSecondaryNav = (isAdmin) => {
  const items = [
    { key: 'nav.goals', icon: <GoalIcon />, route: '/goals' },
    { key: 'nav.dailyTasks', icon: <TaskIcon />, route: '/daily-tasks' },
    { key: 'nav.projects', icon: <ProjectIcon />, route: '/projects' },
    { key: 'nav.debts', icon: <DebtIcon />, route: '/debts' },
    { key: 'nav.aiAssistant', icon: <AIIcon />, route: '/ai' },
    { key: 'nav.settings', icon: <SettingsIcon />, route: '/settings' },
  ]
  if (isAdmin) {
    items.splice(1, 0, { key: 'nav.admin', icon: <AdminIcon />, route: '/admin' })
  }
  return items
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, userData, logout } = useUser()
  const { t } = useTranslation()
  const isAdmin = userData?.role === 'admin'
  const displayName = userData?.name || user?.email?.split('@')[0] || 'User'
  const secondaryNav = getSecondaryNav(isAdmin)
  const roleLabel = userData?.role === 'admin' ? 'Admin' : userData?.role === 'pro' ? 'Pro' : 'Free'

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className={styles.logoTextWrap}>
            <span className={styles.logoText}>{t('appName')}</span>
            <span className={styles.logoBadge}>v2.0</span>
          </div>
        </div>
      </div>

      <div className={styles.navSection}>
        <span className={styles.sectionLabel}>{t('nav.mainMenu')}</span>
        <nav className={styles.nav}>
          {mainNav.map((item) => {
            const isActive = item.route === pathname
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => router.push(item.route)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{t(item.key)}</span>
                {isActive && <span className={styles.activeDot} />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className={styles.navSection}>
        <span className={styles.sectionLabel}>{t('nav.workspace')}</span>
        <nav className={styles.nav}>
          {secondaryNav.map((item) => {
            const isActive = item.route === pathname
            return (
              <button
                key={item.key}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => router.push(item.route)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{t(item.key)}</span>
                {isActive && <span className={styles.activeDot} />}
              </button>
            )
          })}
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.userCard}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span className={styles.onlineDot} />
          </div>
          <div className={styles.userText}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </div>
          <button className={styles.logoutBtn} title={t('auth.logout')} onClick={logout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
