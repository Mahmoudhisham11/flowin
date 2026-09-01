import { verifyQuickToken } from '@/services/quickTokenService'
import { fetchWallets } from '@/services/walletService'
import { CATEGORIES } from '@/lib/categories'

export async function GET(req) {
  try {
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

    // Fetch user's wallets
    const wallets = await fetchWallets(uid)
    const formattedWallets = wallets.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type || 'cash',
      balance: Number(w.balance || 0),
    }))

    // Get categories formatted for Shortcut menus
    const categories = CATEGORIES.filter((c) => c.id !== 'Transfer').map((c) => ({
      id: c.id,
      name: `${c.emoji} ${c.labelAr} - ${c.labelEn}`,
      emoji: c.emoji,
      labelAr: c.labelAr,
      labelEn: c.labelEn,
    }))

    return Response.json({
      success: true,
      wallets: formattedWallets,
      categories,
    })
  } catch (err) {
    console.error('Error in /api/quick-expense/options:', err)
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
