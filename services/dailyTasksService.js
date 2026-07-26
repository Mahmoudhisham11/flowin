import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, onSnapshot, where, orderBy, getDocs } from 'firebase/firestore'

const path = (uid) => `users/${uid}/dailyTasks`

export async function createDailyTask(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToDailyTasks(uid, callback) {
  const ref = collection(db, path(uid))
  return onSnapshot(ref, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export function subscribeToTasksByDate(uid, date, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, where('date', '==', date))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export function subscribeToTasksByDateRange(uid, startDate, endDate, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, where('date', '>=', startDate), where('date', '<=', endDate))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function toggleDailyTask(uid, taskId, completed) {
  const ref = doc(db, path(uid), taskId)
  await updateDoc(ref, { completed, updatedAt: new Date().toISOString() })
}

export async function updateDailyTask(uid, taskId, data) {
  const ref = doc(db, path(uid), taskId)
  await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
}

export async function deleteDailyTask(uid, taskId) {
  const ref = doc(db, path(uid), taskId)
  await deleteDoc(ref)
}
