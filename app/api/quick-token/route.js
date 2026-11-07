import { requireUser, requireWritableUser, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { createQuickExpenseTokenAdmin, revokeQuickExpenseTokenAdmin } from '@/lib/quickTokenAdmin'

// POST: generate (or regenerate) the personal shortcut token. The raw token is returned once.
export async function POST(req) {
  try {
    const user = await requireUser(req)
    rateLimit(`quick-token:${user.uid}`, 5, 60_000)
    await requireWritableUser(user)

    const result = await createQuickExpenseTokenAdmin(user.uid)
    return Response.json({ success: true, ...result })
  } catch (err) {
    return errorResponse(err)
  }
}

// DELETE: revoke the token.
export async function DELETE(req) {
  try {
    const user = await requireUser(req)
    rateLimit(`quick-token:${user.uid}`, 5, 60_000)

    await revokeQuickExpenseTokenAdmin(user.uid)
    return Response.json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
}
