import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireUser, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { exportAccount } from '@/lib/accountData'

// Downloads everything the app stores about the signed-in user as JSON.
export async function GET(req) {
  try {
    const { uid } = await requireUser(req)
    rateLimit(`account-export:${uid}`, 5, 60 * 60_000)

    const data = await exportAccount(getAdminFirestore(), uid)
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="flowin-data.json"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
