'use client'

import { db } from '@/lib/firestore'
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy, Timestamp } from 'firebase/firestore'

const COLLECTION = 'pending_upgrades'

export async function submitUpgradeRequest({ uid, email, phone, refId, amount }) {
  const ref = collection(db, COLLECTION)
  await addDoc(ref, {
    uid,
    email,
    phone,
    refId,
    amount,
    status: 'pending',
    createdAt: Timestamp.now(),
  })
}

export async function getPendingUpgrades() {
  const ref = collection(db, COLLECTION)
  const q = query(ref, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function approveUpgrade(docId) {
  const ref = doc(db, COLLECTION, docId)
  await updateDoc(ref, { status: 'approved' })
}

export async function rejectUpgrade(docId) {
  const ref = doc(db, COLLECTION, docId)
  await updateDoc(ref, { status: 'rejected' })
}
