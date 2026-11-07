import { FieldValue } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { verifyQuickTokenAdmin } from '@/lib/quickTokenAdmin'
import { classifyExpenseCategory } from '@/services/aiClassifier'
import { sendExpenseNotification } from '@/lib/expenseNotification'
import { deductFromBudgetAdmin } from '@/lib/budgetAdmin'
import { getUserDoc, HttpError, errorResponse } from '@/lib/serverAuth'
import { canWrite } from '@/lib/subscriptionLogic'
import { rateLimit } from '@/lib/rateLimit'

const MAX_AMOUNT = 1_000_000_000

export async function POST(req) {
  try {
    // 1. Authenticate with the personal shortcut token
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      throw new HttpError(401, 'Missing or invalid Authorization header. Expected: Bearer <token>')
    }

    const authResult = await verifyQuickTokenAdmin(authHeader.slice(7))
    if (!authResult) {
      throw new HttpError(401, 'Unauthorized: Invalid, expired, or revoked token')
    }

    const { uid } = authResult
    rateLimit(`quick-expense:${uid}`, 30, 60_000)

    // The shortcut must respect the same trial/subscription rules as the app.
    const userData = await getUserDoc(uid)
    if (!canWrite(userData)) {
      throw new HttpError(403, 'Your trial or subscription has expired')
    }

    // 2. Parse and validate JSON body
    let body = {}
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'Malformed JSON in request body')
    }

    const numAmount = parseFloat(body.amount)
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > MAX_AMOUNT) {
      throw new HttpError(400, 'Amount must be a positive number greater than 0')
    }

    const normalizedReason = String(body.reason || '').trim().slice(0, 200)
    if (!normalizedReason) {
      throw new HttpError(400, 'Reason is required')
    }

    // 3. Pick the first wallet
    const db = getAdminFirestore()
    const walletsSnap = await db
      .collection(`users/${uid}/wallets`)
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get()

    if (walletsSnap.empty) {
      throw new HttpError(400, 'No wallet is available for this account')
    }

    const walletRef = walletsSnap.docs[0].ref
    const walletName = walletsSnap.docs[0].data().name || 'Main Wallet'

    // 4. AI category classification (falls back to keyword matching)
    const detectedCategory = await classifyExpenseCategory(normalizedReason)

    // 5. Save the transaction and deduct from the wallet atomically
    const txRef = db.collection(`users/${uid}/transactions`).doc()
    const newBalance = await db.runTransaction(async (t) => {
      const walletSnap = await t.get(walletRef)
      const balance = Number(walletSnap.data()?.balance || 0) - numAmount

      t.set(txRef, {
        amount: numAmount,
        currency: 'EGP',
        category: detectedCategory,
        merchant: '',
        reason: normalizedReason,
        type: 'expense',
        source: 'shortcut',
        walletId: walletRef.id,
        walletName,
        createdAt: new Date().toISOString(),
      })
      t.update(walletRef, { balance, updatedAt: FieldValue.serverTimestamp() })
      return balance
    })

    await deductFromBudgetAdmin(db, uid, detectedCategory, numAmount)

    // 6. Push notification (awaited so the serverless runtime does not terminate early)
    try {
      await sendExpenseNotification({
        userId: uid,
        amount: numAmount,
        category: detectedCategory,
        reason: normalizedReason,
      })
    } catch (notifErr) {
      console.error('[quick-expense] Failed to send push notification:', notifErr?.message || notifErr)
    }

    return Response.json({
      success: true,
      expenseId: txRef.id,
      expense: {
        amount: numAmount,
        reason: normalizedReason,
        category: detectedCategory,
        walletName,
        remainingBalance: newBalance,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}
