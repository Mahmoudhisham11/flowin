'use client'

import { db } from '@/lib/firestore'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

const TRIAL_DAYS = 7
const PRO_DAYS = 30

export async function getSubscription(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : null
}

export async function initTrial(uid) {
  const ref = doc(db, 'users', uid)
  const now = new Date()
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await updateDoc(ref, {
    role: 'free',
    trialStart: now.toISOString(),
    subEnd: trialEnd,
  })
  return { trialStart: now.toISOString(), subEnd: trialEnd }
}

export async function upgradeToPro(uid) {
  const ref = doc(db, 'users', uid)
  const now = new Date()
  const proEnd = new Date(now.getTime() + PRO_DAYS * 24 * 60 * 60 * 1000).toISOString()

  await updateDoc(ref, {
    role: 'pro',
    subStart: now.toISOString(),
    subEnd: proEnd,
  })
  return { subStart: now.toISOString(), subEnd: proEnd }
}

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
