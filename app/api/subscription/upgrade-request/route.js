import { Timestamp } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireUser, HttpError, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { PRO_PRICE as LIST_PRICE } from '@/lib/plans'

// The price is decided here, not by the client.
const PRO_PRICE = Number(process.env.PRO_PRICE_EGP) || Number(LIST_PRICE)

export async function POST(req) {
  try {
    const { uid, email } = await requireUser(req)
    rateLimit(`upgrade-request:${uid}`, 5, 60_000)

    const { phone, refId, amount } = await req.json().catch(() => ({}))
    const cleanPhone = String(phone || '').trim().slice(0, 30)
    const cleanRef = String(refId || '').trim().slice(0, 100)
    if (!cleanPhone || !cleanRef) {
      throw new HttpError(400, 'Phone number and payment reference are required')
    }

    const db = getAdminFirestore()
    const pending = await db
      .collection('pending_upgrades')
      .where('uid', '==', uid)
      .where('status', '==', 'pending')
      .limit(1)
      .get()
    if (!pending.empty) {
      throw new HttpError(409, 'You already have a pending upgrade request')
    }

    await db.collection('pending_upgrades').add({
      uid,
      email: email || '',
      phone: cleanPhone,
      refId: cleanRef,
      amount: PRO_PRICE,
      status: 'pending',
      createdAt: Timestamp.now(),
    })

    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
