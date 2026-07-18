import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, where } from 'firebase/firestore'

const path = (uid) => `users/${uid}/dailyTasks`

export async function createDailyTask(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    completed: false,
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToDailyTasks(uid, date, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, where('date', '==', date))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function toggleDailyTask(uid, taskId, completed) {
  const ref = doc(db, path(uid), taskId)
  await updateDoc(ref, { completed })
}

export async function updateDailyTask(uid, taskId, data) {
  const ref = doc(db, path(uid), taskId)
  await updateDoc(ref, data)
}

export async function deleteDailyTask(uid, taskId) {
  const ref = doc(db, path(uid), taskId)
  await deleteDoc(ref)
}
