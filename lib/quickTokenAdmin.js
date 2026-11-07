import crypto from 'crypto'
import { getAdminFirestore } from './firebaseAdmin'

const COLLECTION = 'quick_expense_tokens'
const TOUCH_INTERVAL_MS = 10 * 60 * 1000

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '').trim()).digest('hex')
}

export function generateTokenString() {
  // 192 bits from a CSPRNG.
  return 'flw_sec_' + crypto.randomBytes(24).toString('base64url')
}

export async function revokeQuickExpenseTokenAdmin(uid) {
  const db = getAdminFirestore()
  const snap = await db.collection(COLLECTION).where('uid', '==', uid).get()

  const batch = db.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  batch.set(
    db.collection('users').doc(uid),
    {
      quickExpenseToken: { active: false, revokedAt: new Date().toISOString() },
    },
    { merge: true }
  )
  await batch.commit()
}

/** Creates a new token (revoking any previous one). Returns the raw token exactly once. */
export async function createQuickExpenseTokenAdmin(uid) {
  const db = getAdminFirestore()
  await revokeQuickExpenseTokenAdmin(uid)

  const rawToken = generateTokenString()
  const tokenHash = hashToken(rawToken)
  const prefix = rawToken.slice(0, 12) + '...'
  const now = new Date().toISOString()

  const batch = db.batch()
  batch.set(db.collection(COLLECTION).doc(tokenHash), {
    uid,
    tokenHash,
    prefix,
    createdAt: now,
    lastUsedAt: null,
    active: true,
  })
  batch.set(
    db.collection('users').doc(uid),
    { quickExpenseToken: { active: true, prefix, createdAt: now, lastUsedAt: null } },
    { merge: true }
  )
  await batch.commit()

  return { rawToken, prefix, createdAt: now }
}

/** Returns { uid, tokenHash, prefix } for a valid token, otherwise null. */
export async function verifyQuickTokenAdmin(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null
  const token = rawToken.trim()
  if (!token.startsWith('flw_sec_') || token.length > 200) return null

  const db = getAdminFirestore()
  const tokenHash = hashToken(token)
  const ref = db.collection(COLLECTION).doc(tokenHash)
  const snap = await ref.get()
  if (!snap.exists) return null

  const data = snap.data()
  if (!data.active || !data.uid) return null

  const last = data.lastUsedAt ? new Date(data.lastUsedAt).getTime() : 0
  if (Date.now() - last > TOUCH_INTERVAL_MS) {
    const nowIso = new Date().toISOString()
    ref.update({ lastUsedAt: nowIso }).catch(() => {})
    db.collection('users')
      .doc(data.uid)
      .set({ quickExpenseToken: { lastUsedAt: nowIso } }, { merge: true })
      .catch(() => {})
  }

  return { uid: data.uid, tokenHash, prefix: data.prefix }
}
