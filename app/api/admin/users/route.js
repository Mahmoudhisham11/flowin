import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireAdmin, HttpError, errorResponse } from '@/lib/serverAuth'

const ALLOWED_ROLES = ['free', 'pro', 'admin']

// Only profile/plan fields are exposed to the admin panel (no tokens, no financial data).
const PUBLIC_FIELDS = ['name', 'email', 'role', 'provider', 'signUpMethod', 'createdAt', 'trialStart', 'subStart', 'subEnd']

export async function GET(req) {
  try {
    await requireAdmin(req)
    const snap = await getAdminFirestore().collection('users').limit(2000).get()
    const users = snap.docs.map((d) => {
      const data = d.data()
      const out = { id: d.id }
      PUBLIC_FIELDS.forEach((f) => {
        if (data[f] !== undefined) out[f] = data[f]
      })
      return out
    })
    return Response.json({ success: true, users })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PATCH(req) {
  try {
    const admin = await requireAdmin(req)
    const { uid, role } = await req.json().catch(() => ({}))

    if (typeof uid !== 'string' || !uid || !ALLOWED_ROLES.includes(role)) {
      throw new HttpError(400, 'Valid uid and role are required')
    }
    if (uid === admin.uid && role !== 'admin') {
      throw new HttpError(400, 'You cannot remove your own admin role')
    }

    await getAdminFirestore().collection('users').doc(uid).update({ role })
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
