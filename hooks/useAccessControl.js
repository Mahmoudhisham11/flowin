'use client'

import { useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { checkSubscription } from '@/services/subscriptionService'

export function useAccessControl() {
  const { userData } = useUser()

  const sub = useMemo(() => checkSubscription(userData), [userData])

  return useMemo(() => {
    const adminBypass = userData?.role === 'admin'
    const featureBlocked = !adminBypass && sub.expired

    return {
      canVoiceAI: adminBypass || (!sub.expired && sub.plan !== 'free'),
      canChatAI: adminBypass || (!sub.expired && sub.plan !== 'free'),
      canCreateTransaction: !featureBlocked,
      canManageWallets: !featureBlocked,
      canAccessAnalytics: adminBypass || (!sub.expired && sub.plan !== 'free'),
      canAccessReports: adminBypass || (!sub.expired && sub.plan !== 'free'),
      canUseGoals: !featureBlocked,
      canUseDebts: !featureBlocked,
      blockAll: featureBlocked,
      ...sub,
    }
  }, [sub, userData?.role])
}
