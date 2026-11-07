import { db } from '@/lib/firestore'
import {
  collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, increment, arrayUnion,
} from 'firebase/firestore'

const path = (uid) => `users/${uid}/goals`

export function subscribeToGoals(uid, callback) {
  const q = query(collection(db, path(uid)), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
}

/** goal: validated fields from normalizeGoalInput(). */
export async function createGoal(uid, goal) {
  const ref = await addDoc(collection(db, path(uid)), {
    ...goal,
    savedAmount: 0,
    contributions: [],
    createdAt: new Date().toISOString(),
  })
  return ref.id
}

export async function updateGoal(uid, goalId, fields) {
  await updateDoc(doc(db, path(uid), goalId), { ...fields, updatedAt: new Date().toISOString() })
}

export async function deleteGoal(uid, goalId) {
  await deleteDoc(doc(db, path(uid), goalId))
}

/**
 * Adds (positive) or withdraws (negative) money. Uses increment() so two devices
 * adding at the same time never overwrite each other.
 */
export async function addContribution(uid, goal, amount, note = '') {
  const delta = Number(amount)
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Enter a valid amount')
  if (delta < 0 && -delta > (Number(goal.savedAmount) || 0)) throw new Error('You cannot withdraw more than you saved')

  const now = new Date().toISOString()
  const reaches = (Number(goal.savedAmount) || 0) + delta >= Number(goal.targetAmount)
  await updateDoc(doc(db, path(uid), goal.id), {
    savedAmount: increment(delta),
    contributions: arrayUnion({ amount: delta, note: String(note).slice(0, 80), at: now }),
    updatedAt: now,
    ...(reaches && !goal.completedAt ? { completedAt: now } : {}),
  })
}
