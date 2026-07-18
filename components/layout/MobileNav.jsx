'use client'

import { usePathname, useRouter } from 'next/navigation'
import { HomeIcon, TransactionIcon, ReportIcon, AIIcon } from '@/components/Icons'
import styles from './MobileNav.module.css'

const navItems = [
  { label: 'Home', icon: <HomeIcon />, route: '/' },
  { label: 'Transactions', icon: <TransactionIcon />, route: '/transactions' },
  { label: 'Analytics', icon: <ReportIcon />, route: '/analytics' },
  { label: 'AI', icon: <AIIcon />, route: '/ai' },
]

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <nav className={styles.nav}>
      {navItems.map((item, i) => {
        const isActive = item.route === pathname
        return (
          <button
            key={i}
            className={`${styles.item} ${isActive ? styles.active : ''}`}
            onClick={() => router.push(item.route)}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
