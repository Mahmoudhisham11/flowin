'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useEffect } from 'react'

export default function AuthGuard({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userData, loading, userLoading } = useUser()

  const isAuthPage = pathname === '/login'

  useEffect(() => {
    if (loading) return
    if (!userData && !isAuthPage) {
      router.replace('/login')
    }
    if (userData && isAuthPage) {
      router.replace('/')
    }
  }, [userData, loading, isAuthPage, router])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F7FAFF' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#4DA3FF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isAuthPage) {
    if (userData) return null
    return <div id="auth-root">{children}</div>
  }

  if (!userData) return null

  return <>{children}</>
}
