'use client'

import { useUser } from '@/contexts/UserContext'
import { normalizeCurrency } from '@/lib/currency'

/** The signed-in user's currency code (e.g. "EGP"). Defaults to EGP for existing users. */
export function useCurrency() {
  const { userData } = useUser()
  return normalizeCurrency(userData?.currency)
}
