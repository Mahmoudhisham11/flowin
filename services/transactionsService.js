import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore'
import { deductFromBudget } from './budgetService'

const path = (uid) => `users/${uid}/transactions`

export async function saveTransaction(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: new Date().toISOString(),
  })
  if (data.type === 'expense' && data.category) {
    deductFromBudget(uid, data.category, data.amount).catch((err) => console.error('deductFromBudget error:', err))
  }
  return docRef.id
}

export async function updateTransaction(uid, transactionId, data) {
  const ref = doc(db, path(uid), transactionId)
  await updateDoc(ref, data)
}

export async function deleteTransaction(uid, transactionId) {
  const ref = doc(db, path(uid), transactionId)
  await deleteDoc(ref)
}

export function subscribeToTransactions(uid, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function fetchTransactions(uid) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

