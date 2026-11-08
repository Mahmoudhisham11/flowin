import { getAdminFirestore } from './firebaseAdmin'
import { HttpError } from './serverAuth'

const DEFAULT_DAILY_LIMIT = Number(process.env.AI_CHAT_DAILY_LIMIT) > 0 ? Number(process.env.AI_CHAT_DAILY_LIMIT) : 40

/** Daily chat messages allowed for this user; null means unlimited (admins). */
export function dailyLimitFor(userData) {
  return userData?.role === 'admin' ? null : DEFAULT_DAILY_LIMIT
}

const docFor = (db, uid, day) => db.doc(`users/${uid}/usage/${day}`)

/** Messages left today without using one. `day` is the user's local 'YYYY-MM-DD'. */
export async function getQuota(uid, userData, day, db = getAdminFirestore()) {
  const limit = dailyLimitFor(userData)
  if (limit === null) return { limit: null, used: 0, remaining: null }
  const snap = await docFor(db, uid, day).get()
  const used = Number(snap.exists ? snap.data().aiChat : 0) || 0
  return { limit, used, remaining: Math.max(0, limit - used) }
}

/** Uses one message atomically. Throws 429 when the day's limit is reached. */
export async function consumeQuota(uid, userData, day, db = getAdminFirestore()) {
  const limit = dailyLimitFor(userData)
  if (limit === null) return { limit: null, used: 0, remaining: null }

  const ref = docFor(db, uid, day)
  const used = await db.runTransaction(async (t) => {
    const snap = await t.get(ref)
    const current = Number(snap.exists ? snap.data().aiChat : 0) || 0
    if (current >= limit) throw new HttpError(429, 'DAILY_LIMIT')
    t.set(ref, { aiChat: current + 1, updatedAt: new Date().toISOString() }, { merge: true })
    return current + 1
  })
  return { limit, used, remaining: Math.max(0, limit - used) }
}
