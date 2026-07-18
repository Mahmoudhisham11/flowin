import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore'

const path = (uid) => `users/${uid}/wallets`

export async function createWallet(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToWallets(uid, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function updateWallet(uid, walletId, data) {
  const ref = doc(db, path(uid), walletId)
  await updateDoc(ref, data)
}

export async function deleteWallet(uid, walletId) {
  const ref = doc(db, path(uid), walletId)
  await deleteDoc(ref)
}

export async function fetchWallets(uid) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'asc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const WALLET_TYPES = [
  { id: 'cash', labelEn: 'Cash', labelAr: 'نقدي', emoji: '💵' },
  { id: 'card', labelEn: 'Card', labelAr: 'كارت', emoji: '💳' },
  { id: 'bank', labelEn: 'Bank', labelAr: 'حساب بنكي', emoji: '🏦' },
]

export const WALLET_COLORS = ['#4DA3FF', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316']

