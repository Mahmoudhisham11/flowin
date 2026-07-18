import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'
import { updateWallet } from './walletService'

const path = (uid) => `users/${uid}/goals`

export async function createGoal(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    saved: 0,
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToGoals(uid, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function updateGoal(uid, goalId, data) {
  const ref = doc(db, path(uid), goalId)
  await updateDoc(ref, data)
}

export async function deleteGoal(uid, goalId) {
  const ref = doc(db, path(uid), goalId)
  await deleteDoc(ref)
}

export async function addMoneyToGoal(uid, goalId, goal, amount, walletId, wallet) {
  const goalRef = doc(db, path(uid), goalId)
  await updateGoal(uid, goalId, { saved: (goal.saved || 0) + amount })
  await updateWallet(uid, walletId, { balance: (wallet.balance || 0) - amount })
}

export async function withdrawFromGoal(uid, goalId, goal, amount, walletId, wallet) {
  const goalRef = doc(db, path(uid), goalId)
  await updateGoal(uid, goalId, { saved: Math.max(0, (goal.saved || 0) - amount) })
  await updateWallet(uid, walletId, { balance: (wallet.balance || 0) + amount })
}
