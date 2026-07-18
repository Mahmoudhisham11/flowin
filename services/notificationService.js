import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, doc, query, orderBy, onSnapshot, getDocs, writeBatch } from 'firebase/firestore'

const NOTIF_PATH = (uid) => `users/${uid}/notifications`

export async function createNotification(uid, data) {
  const ref = collection(db, NOTIF_PATH(uid))
  return addDoc(ref, {
    ...data,
    read: false,
    createdAt: new Date().toISOString(),
  })
}

export function subscribeToNotifications(uid, callback) {
  const ref = collection(db, NOTIF_PATH(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function markNotificationRead(uid, id) {
  const ref = doc(db, `${NOTIF_PATH(uid)}/${id}`)
  return updateDoc(ref, { read: true })
}

export async function markAllNotificationsRead(uid) {
  const ref = collection(db, NOTIF_PATH(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    if (!d.data().read) {
      batch.update(d.ref, { read: true })
    }
  })
  return batch.commit()
}
