'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/navigation/BottomNav'

export default function AppShell({ children }) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'

  if (isAuthPage) return <>{children}</>

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  )
}
