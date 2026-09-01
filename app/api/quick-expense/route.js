import { verifyQuickToken } from '@/services/quickTokenService'
import { saveTransaction } from '@/services/transactionsService'
import { fetchWallets, updateWallet } from '@/services/walletService'
import { classifyExpenseCategory } from '@/services/aiClassifier'
import { sendPushNotificationToUser } from '@/services/serverFcm'
import { CATEGORIES } from '@/lib/categories'

export async function POST(req) {
  try {
    // 1. Authenticate with Bearer token
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json(
        { success: false, error: 'Missing or invalid Authorization header. Expected: Bearer <token>' },
        { status: 401 }
      )
    }

    const rawToken = authHeader.replace('Bearer ', '').trim()
    const authResult = await verifyQuickToken(rawToken)

    if (!authResult || !authResult.uid) {
      return Response.json(
        { success: false, error: 'Unauthorized: Invalid, expired, or revoked token' },
        { status: 401 }
      )
    }

    const { uid } = authResult

    // 2. Parse and validate JSON body
    let body = {}
    try {
      body = await req.json()
    } catch {
      return Response.json(
        { success: false, error: 'Malformed JSON in request body' },
        { status: 400 }
      )
    }

    const { amount, reason } = body

    // 3. Validate Amount
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return Response.json(
        { success: false, error: 'Amount must be a positive number greater than 0' },
        { status: 400 }
      )
    }

    // 4. Validate Reason
    const normalizedReason = String(reason || '').trim()
    if (!normalizedReason) {
      return Response.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      )
    }

    // 5. Fetch user's wallets and pick the first one automatically
    const wallets = await fetchWallets(uid)
    if (!wallets || wallets.length === 0) {
      return Response.json(
        { success: false, error: 'No wallet is available for this account' },
        { status: 400 }
      )
    }

    const firstWallet = wallets[0]
    const walletId = firstWallet.id
    const walletName = firstWallet.name || 'Main Wallet'
    const currentBalance = Number(firstWallet.balance || 0)

    // 6. AI Category Classification
    const detectedCategory = await classifyExpenseCategory(normalizedReason)

    // 7. Save Transaction to Firestore
    const transactionData = {
      amount: numAmount,
      currency: 'EGP',
      category: detectedCategory,
      merchant: '',
      reason: normalizedReason,
      type: 'expense',
      source: 'shortcut',
      walletId,
      walletName,
    }

    const expenseId = await saveTransaction(uid, transactionData)

    // 8. Deduct from first wallet balance
    const newBalance = currentBalance - numAmount
    await updateWallet(uid, walletId, {
      balance: newBalance,
    })

    // 9. Send Push Notification asynchronously (Non-blocking)
    try {
      const catItem = CATEGORIES.find((c) => c.id === detectedCategory) || { labelAr: detectedCategory, emoji: '💸' }
      const catLabel = catItem.labelAr || detectedCategory
      const catEmoji = catItem.emoji || '💸'

      sendPushNotificationToUser(uid, {
        title: 'Flowin ✅',
        body: `تم تسجيل ${numAmount} جنيه — ${catLabel} ${catEmoji}`,
        data: {
          type: 'expense_created',
          expenseId,
          amount: String(numAmount),
          category: detectedCategory,
          walletName,
          url: '/',
        },
      }).catch((notifErr) => {
        console.warn('[QuickExpense] FCM push error (non-fatal):', notifErr.message)
      })
    } catch (pushErr) {
      console.warn('[QuickExpense] Error dispatching push notification:', pushErr)
    }

    return Response.json({
      success: true,
      expenseId,
      expense: {
        amount: numAmount,
        reason: normalizedReason,
        category: detectedCategory,
        walletName,
        remainingBalance: newBalance,
      },
    })
  } catch (err) {
    console.error('Error in /api/quick-expense:', err)
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
