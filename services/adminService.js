import { db } from '@/lib/firestore'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'

export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function updateUserRole(uid, newRole) {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, { role: newRole })
}
