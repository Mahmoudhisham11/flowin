import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { verifyQuickTokenAdmin } from '@/lib/quickTokenAdmin'
import { rateLimit } from '@/lib/rateLimit'
import { HttpError, errorResponse } from '@/lib/serverAuth'
import { CATEGORIES } from '@/lib/categories'

export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing or invalid Authorization header. Expected: Bearer <token>')
    }

    const authResult = await verifyQuickTokenAdmin(authHeader.slice(7))
    if (!authResult) {
      throw new HttpError(401, 'Unauthorized: Invalid, expired, or revoked token')
    }

    const { uid } = authResult
    rateLimit(`quick-expense-options:${uid}`, 30, 60_000)

    const walletsSnap = await getAdminFirestore()
      .collection(`users/${uid}/wallets`)
      .orderBy('createdAt', 'asc')
      .get()

    const formattedWallets = walletsSnap.docs.map((d) => {
      const w = d.data()
      return {
        id: d.id,
        name: w.name,
        type: w.type || 'cash',
        balance: Number(w.balance || 0),
      }
    })

    const categories = CATEGORIES.filter((c) => c.id !== 'Transfer').map((c) => ({
      id: c.id,
      name: `${c.emoji} ${c.labelAr} - ${c.labelEn}`,
      emoji: c.emoji,
      labelAr: c.labelAr,
      labelEn: c.labelEn,
    }))

    return Response.json({ success: true, wallets: formattedWallets, categories })
  } catch (err) {
    return errorResponse(err)
  }
}
