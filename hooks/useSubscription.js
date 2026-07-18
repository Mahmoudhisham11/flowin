'use client'

import { useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { checkSubscription } from '@/services/subscriptionService'

export function useSubscription() {
  const { userData } = useUser()

  const sub = useMemo(() => checkSubscription(userData), [userData])

  return {
    ...sub,
    isFree: sub.plan === 'free',
    isPro: sub.plan === 'pro',
    isAdmin: sub.plan === 'admin',
    isBlocked: sub.expired,
  }
}
