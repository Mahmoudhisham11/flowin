import { db } from '@/lib/firestore'
import { collection, addDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'

const path = (uid, debtId) => `users/${uid}/debts/${debtId}/payments`

export async function createPayment(uid, debtId, data) {
  const ref = collection(db, path(uid, debtId))
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToPayments(uid, debtId, callback) {
  const ref = collection(db, path(uid, debtId))
  const q = query(ref, orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function deletePayment(uid, debtId, paymentId) {
  const ref = doc(db, path(uid, debtId), paymentId)
  await deleteDoc(ref)
}
