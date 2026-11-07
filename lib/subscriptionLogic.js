// Pure subscription logic shared by the client (hooks) and the server (API routes).
// Keep this file free of Firebase imports.

export function checkSubscription(userData) {
  if (!userData) return { active: false, plan: null, daysLeft: 0, expired: true }

  const { role, subEnd } = userData

  if (role === 'admin') {
    return { active: true, plan: 'admin', daysLeft: Infinity, expired: false }
  }

  if (!subEnd) {
    return { active: false, plan: role || 'free', daysLeft: 0, expired: true }
  }

  const end = new Date(subEnd)
  const now = new Date()
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const expired = daysLeft <= 0

  return {
    active: !expired,
    plan: role || 'free',
    daysLeft,
    expired,
    endDate: subEnd,
  }
}

// Mirrors useAccessControl: paid features need an admin, or a non-free plan that has not expired.
export function hasPaidAccess(userData) {
  if (userData?.role === 'admin') return true
  const sub = checkSubscription(userData)
  return !sub.expired && sub.plan !== 'free'
}

// Mirrors useAccessControl.canCreateTransaction: blocked only when the subscription/trial expired.
export function canWrite(userData) {
  if (userData?.role === 'admin') return true
  return !checkSubscription(userData).expired
}
