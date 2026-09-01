import { verifyQuickToken } from '@/services/quickTokenService'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { CATEGORIES } from '@/lib/categories'
import { db } from '@/lib/firestore'
import { doc, getDoc } from 'firebase/firestore'

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

    const { walletId, amount, category, reason, merchant, date } = body

    // 3. Validate Amount
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      return Response.json(
        { success: false, error: 'Amount must be a positive number greater than 0' },
        { status: 400 }
      )
    }

    // 4. Validate Wallet ID
    if (!walletId || typeof walletId !== 'string') {
      return Response.json(
        { success: false, error: 'walletId is required' },
        { status: 400 }
      )
    }

    // Verify wallet belongs to this user
    const walletRef = doc(db, 'users', uid, 'wallets', walletId)
    const walletSnap = await getDoc(walletRef)

    if (!walletSnap.exists()) {
      return Response.json(
        { success: false, error: 'Selected wallet does not exist or does not belong to this account' },
        { status: 404 }
      )
    }

    const walletData = walletSnap.data()
    const walletName = walletData.name || 'Main Wallet'
    const currentBalance = Number(walletData.balance || 0)

    // 5. Validate / Normalize Category
    let selectedCategory = 'Other'
    if (category && typeof category === 'string') {
      const match = CATEGORIES.find(
        (c) =>
          c.id.toLowerCase() === category.toLowerCase() ||
          c.labelAr.toLowerCase() === category.toLowerCase() ||
          c.labelEn.toLowerCase() === category.toLowerCase()
      )
      if (match) {
        selectedCategory = match.id
      } else {
        selectedCategory = category.trim()
      }
    }

    // 6. Save Transaction to Firestore
    const transactionData = {
      amount: numAmount,
      currency: 'EGP',
      category: selectedCategory,
      merchant: String(merchant || '').trim(),
      reason: String(reason || '').trim(),
      type: 'expense',
      source: 'shortcut',
      walletId,
      walletName,
      ...(date ? { createdAt: new Date(date).toISOString() } : {}),
    }

    const expenseId = await saveTransaction(uid, transactionData)

    // 7. Deduct from wallet balance
    const newBalance = currentBalance - numAmount
    await updateWallet(uid, walletId, {
      balance: newBalance,
    })

    return Response.json({
      success: true,
      message: 'Expense created successfully',
      expenseId,
      expense: {
        id: expenseId,
        amount: numAmount,
        currency: 'EGP',
        category: selectedCategory,
        reason: transactionData.reason,
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
