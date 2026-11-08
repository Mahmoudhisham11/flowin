import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireUser, getUserDoc, HttpError, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { deleteAccount } from '@/lib/accountData'

const RECENT_SIGN_IN_SECONDS = 10 * 60

// Permanently deletes the signed-in user's data and account. Irreversible.
export async function POST(req) {
  try {
    const user = await requireUser(req)
    rateLimit(`account-delete:${user.uid}`, 3, 60 * 60_000)

    const body = await req.json().catch(() => ({}))
    if (body.confirm !== 'DELETE') throw new HttpError(400, 'Confirmation text is missing')

    // Sensitive action: the sign-in must be recent, otherwise ask the user to sign in again.
    if (Date.now() / 1000 - user.authTime > RECENT_SIGN_IN_SECONDS) {
      return Response.json(
        { success: false, code: 'REAUTH', error: 'For your security, please sign in again and retry.' },
        { status: 401 }
      )
    }

    // An admin account cannot delete itself, so the panel is never left without an admin.
    const profile = await getUserDoc(user.uid)
    if (profile?.role === 'admin') {
      throw new HttpError(403, 'Admin accounts cannot be deleted here. Change the role first.')
    }

    await deleteAccount(getAdminFirestore(), user.uid)
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
