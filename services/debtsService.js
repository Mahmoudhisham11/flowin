import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'

const path = (uid) => `users/${uid}/debts`

export async function createDebt(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    paid: 0,
    remaining: data.amount,
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToDebts(uid, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function updateDebt(uid, debtId, data) {
  const ref = doc(db, path(uid), debtId)
  await updateDoc(ref, data)
}

export async function deleteDebt(uid, debtId) {
  const ref = doc(db, path(uid), debtId)
  await deleteDoc(ref)
}
