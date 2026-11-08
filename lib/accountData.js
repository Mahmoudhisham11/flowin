import { getAuth } from 'firebase-admin/auth'
import { initAdmin } from './firebaseAdmin'

// Per-user subcollections that hold the user's own data.
const SUBCOLLECTIONS = ['wallets', 'transactions', 'budget', 'goals', 'dailyTasks', 'insights']

// Profile fields that are internal/credential-like and are not part of the export.
const HIDDEN_PROFILE_FIELDS = ['fcmToken', 'fcmUpdatedAt', 'quickExpenseToken']

/** Converts Firestore values (Timestamps, nested objects) into plain JSON. */
export function toPlain(value) {
  if (value === null || value === undefined) return value ?? null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(toPlain)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]))
  return value
}

export async function exportAccount(db, uid) {
  const profileSnap = await db.doc(`users/${uid}`).get()
  const profile = profileSnap.exists ? { ...profileSnap.data() } : {}
  HIDDEN_PROFILE_FIELDS.forEach((f) => delete profile[f])

  const data = {}
  for (const name of SUBCOLLECTIONS) {
    const snap = await db.collection(`users/${uid}/${name}`).get()
    data[name] = snap.docs.map((d) => ({ id: d.id, ...toPlain(d.data()) }))
  }

  const upgrades = await db.collection('pending_upgrades').where('uid', '==', uid).get()
  data.upgradeRequests = upgrades.docs.map((d) => {
    const { uid: _uid, ...rest } = toPlain(d.data())
    return { id: d.id, ...rest }
  })

  return { exportedAt: new Date().toISOString(), app: 'Flowin', profile: toPlain(profile), ...data }
}

/** Deletes every document that belongs to the user, then the sign-in account itself. */
export async function deleteAccount(db, uid) {
  // Shortcut token hashes and upgrade requests live in top-level collections.
  const [tokens, upgrades] = await Promise.all([
    db.collection('quick_expense_tokens').where('uid', '==', uid).get(),
    db.collection('pending_upgrades').where('uid', '==', uid).get(),
  ])
  await Promise.all([...tokens.docs, ...upgrades.docs].map((d) => d.ref.delete()))

  // Removes the profile document and all of its subcollections (including usage and fcm_tokens).
  await db.recursiveDelete(db.doc(`users/${uid}`))

  initAdmin()
  try {
    await getAuth().deleteUser(uid)
  } catch (err) {
    if (err?.code !== 'auth/user-not-found') throw err
  }
}
