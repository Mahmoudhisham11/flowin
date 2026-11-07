import { NextResponse } from 'next/server'
import { sendExpenseNotification } from '@/lib/expenseNotification'
import { requireUser, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req) {
  try {
    // The recipient is always the authenticated user: client-supplied userId/token are ignored.
    const { uid } = await requireUser(req)
    rateLimit(`notify-expense:${uid}`, 30, 60_000)

    const body = await req.json().catch(() => ({}))
    const { amount, category, merchant, reason, title, userDate, userTimezone } = body

    const result = await sendExpenseNotification({
      userId: uid,
      amount: Number(amount) || 0,
      category: typeof category === 'string' ? category.slice(0, 50) : '',
      merchant: typeof merchant === 'string' ? merchant.slice(0, 100) : '',
      reason: typeof reason === 'string' ? reason.slice(0, 200) : '',
      title: typeof title === 'string' ? title.slice(0, 100) : '',
      userDate: typeof userDate === 'string' ? userDate.slice(0, 10) : undefined,
      userTimezone: typeof userTimezone === 'string' ? userTimezone.slice(0, 64) : undefined,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    return errorResponse(error, 'Failed to send notification')
  }
}
