import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireAdmin, HttpError, errorResponse } from '@/lib/serverAuth'

const PRO_DAYS = 30

function toIso(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  return value
}

export async function GET(req) {
  try {
    await requireAdmin(req)
    const snap = await getAdminFirestore()
      .collection('pending_upgrades')
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get()

    const upgrades = snap.docs.map((d) => {
      const data = d.data()
      return { id: d.id, ...data, createdAt: toIso(data.createdAt) }
    })
    return Response.json({ success: true, upgrades })
  } catch (err) {
    return errorResponse(err)
  }
}

// Approve (upgrade the user to Pro for 30 days) or reject a request, in one atomic step.
export async function POST(req) {
  try {
    await requireAdmin(req)
    const { id, action } = await req.json().catch(() => ({}))

    if (typeof id !== 'string' || !id || !['approve', 'reject'].includes(action)) {
      throw new HttpError(400, 'Valid id and action (approve|reject) are required')
    }

    const db = getAdminFirestore()
    const reqRef = db.collection('pending_upgrades').doc(id)

    await db.runTransaction(async (t) => {
      const snap = await t.get(reqRef)
      if (!snap.exists) throw new HttpError(404, 'Upgrade request not found')
      if (snap.data().status !== 'pending') throw new HttpError(409, 'This request was already processed')

      if (action === 'approve') {
        const uid = snap.data().uid
        if (!uid) throw new HttpError(400, 'Request has no user')
        const now = new Date()
        t.update(db.collection('users').doc(uid), {
          role: 'pro',
          subStart: now.toISOString(),
          subEnd: new Date(now.getTime() + PRO_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
      t.update(reqRef, { status: action === 'approve' ? 'approved' : 'rejected' })
    })

    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
