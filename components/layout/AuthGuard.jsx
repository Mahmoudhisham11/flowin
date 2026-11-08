'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useEffect } from 'react'

// Pages anyone can open without signing in.
const PUBLIC_PATHS = ['/welcome', '/privacy', '/terms']

export default function AuthGuard({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { userData, loading, userLoading } = useUser()

  const isAuthPage = pathname === '/login'
  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isOnboarding = pathname === '/onboarding'
  // Every account must set up its plan once (income, fixed expenses, savings).
  const needsOnboarding = Boolean(userData) && !userData.onboardingCompleted

  useEffect(() => {
    if (isPublic) return
    if (loading) return
    if (!userData && !isAuthPage) {
      // Visitors see the landing page at the root, everything else asks them to sign in.
      router.replace(pathname === '/' ? '/welcome' : '/login')
    }
    if (userData && isAuthPage) {
      router.replace('/')
      return
    }
    if (needsOnboarding && !isOnboarding) {
      router.replace('/onboarding')
    }
  }, [userData, loading, isAuthPage, isPublic, isOnboarding, needsOnboarding, pathname, router])

  if (isPublic) return <>{children}</>

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

  // Avoid flashing the app before redirecting to onboarding.
  if (needsOnboarding && !isOnboarding) return null

  return <>{children}</>
}
