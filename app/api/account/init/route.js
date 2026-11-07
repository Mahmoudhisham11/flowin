import { getAuth } from 'firebase-admin/auth'
import { getAdminFirestore, initAdmin } from '@/lib/firebaseAdmin'
import { requireUser, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

const TRIAL_DAYS = 7

// Creates the user profile (with the free trial) on first sign-in. Idempotent.
// Role and trial dates are decided here, never by the client.
export async function POST(req) {
  try {
    const { uid, email } = await requireUser(req)
    rateLimit(`account-init:${uid}`, 10, 60_000)

    const db = getAdminFirestore()
    const ref = db.collection('users').doc(uid)

    const existing = await ref.get()
    if (existing.exists) {
      return Response.json({ success: true, created: false, user: existing.data() })
    }

    initAdmin()
    const record = await getAuth().getUser(uid)
    const body = await req.json().catch(() => ({}))
    const hintedName = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : ''

    const providerId = record.providerData?.[0]?.providerId || 'password'
    const now = new Date()
    const newUser = {
      uid,
      name: record.displayName || hintedName || (email || '').split('@')[0] || 'User',
      email: email || record.email || '',
      provider: providerId,
      createdAt: now.toISOString(),
      signUpMethod: providerId === 'google.com' ? 'google' : 'email',
      role: 'free',
      trialStart: now.toISOString(),
      subEnd: new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    }

    try {
      await ref.create(newUser)
    } catch (err) {
      // Lost a race with a concurrent request: return the document that won.
      if (err?.code === 6 || /already exists/i.test(err?.message || '')) {
        const snap = await ref.get()
        return Response.json({ success: true, created: false, user: snap.data() })
      }
      throw err
    }

    return Response.json({ success: true, created: true, user: newUser })
  } catch (err) {
    return errorResponse(err)
  }
}
