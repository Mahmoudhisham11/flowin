import { db } from '@/lib/firestore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getBudget } from './budgetService'
import { computeToday, getPeriod } from '@/lib/planEngine'
import { walletsTotal } from '@/lib/walletTotal'

/**
 * One-time snapshot of the user's plan and this pay period's transactions, used by modals
 * (purchase advisor, expense preview). Reads only the current period, not the whole history.
 */
export async function fetchTodayState(uid, now = new Date()) {
  const budget = await getBudget(uid)
  if (!budget?.planVersion) return { budget, transactions: [], today: { hasPlan: false } }

  const period = getPeriod(budget, now)
  // Two extra days cover timezone differences between the stored UTC timestamps and the local day.
  const since = new Date(period.start.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const [snap, walletsSnap] = await Promise.all([
    getDocs(query(collection(db, `users/${uid}/transactions`), where('createdAt', '>=', since))),
    getDocs(collection(db, `users/${uid}/wallets`)),
  ])
  const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const wallets = walletsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const opts = { walletsTotal: walletsTotal(wallets) }

  return { budget, transactions, wallets, today: computeToday(budget, transactions, now, undefined, opts) }
}
