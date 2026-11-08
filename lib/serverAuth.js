import { getAuth } from 'firebase-admin/auth'
import { initAdmin, getAdminFirestore } from './firebaseAdmin'
import { hasPaidAccess, canWrite } from './subscriptionLogic'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** Verifies the Firebase ID token in `Authorization: Bearer <token>` and returns the user. */
export async function requireUser(req) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new HttpError(401, 'Authentication required')

  initAdmin()
  try {
    const decoded = await getAuth().verifyIdToken(match[1].trim())
    // authTime (seconds) lets sensitive routes require a recent sign-in.
    return { uid: decoded.uid, email: decoded.email || '', authTime: Number(decoded.auth_time) || 0 }
  } catch {
    throw new HttpError(401, 'Invalid or expired session. Please sign in again.')
  }
}

export async function getUserDoc(uid) {
  const snap = await getAdminFirestore().collection('users').doc(uid).get()
  return snap.exists ? snap.data() : null
}

export async function requireAdmin(req) {
  const user = await requireUser(req)
  const data = await getUserDoc(user.uid)
  if (data?.role !== 'admin') throw new HttpError(403, 'Admin access required')
  return { ...user, userData: data }
}

/** Authenticated user whose plan includes paid features (chat, voice AI). */
export async function requirePaidUser(req) {
  const user = await requireUser(req)
  const data = await getUserDoc(user.uid)
  if (!hasPaidAccess(data)) throw new HttpError(403, 'This feature requires an active Pro plan')
  return { ...user, userData: data }
}

/** Authenticated user whose trial/subscription has not expired (needed to write data). */
export async function requireWritableUser(user) {
  const data = await getUserDoc(user.uid)
  if (!canWrite(data)) throw new HttpError(403, 'Your trial or subscription has expired')
  return data
}

export function errorResponse(err, fallbackMessage = 'Internal server error') {
  // An AI call that hit its time limit (AbortSignal.timeout) is a gateway timeout, not a server bug.
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return Response.json({ success: false, error: 'The AI service took too long. Please try again.' }, { status: 504 })
  }
  if (err instanceof HttpError) {
    return Response.json({ success: false, error: err.message }, { status: err.status })
  }
  console.error('[api] Unexpected error:', err)
  return Response.json({ success: false, error: fallbackMessage }, { status: 500 })
}
