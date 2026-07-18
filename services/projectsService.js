import { db } from '@/lib/firestore'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore'

const path = (uid) => `users/${uid}/projects`

export async function createProject(uid, data) {
  const ref = collection(db, path(uid))
  const docRef = await addDoc(ref, {
    ...data,
    progress: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}

export function subscribeToProjects(uid, callback) {
  const ref = collection(db, path(uid))
  const q = query(ref, orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(list)
  })
}

export async function updateProject(uid, projectId, data) {
  const ref = doc(db, path(uid), projectId)
  await updateDoc(ref, data)
}

export async function deleteProject(uid, projectId) {
  const ref = doc(db, path(uid), projectId)
  await deleteDoc(ref)
}
