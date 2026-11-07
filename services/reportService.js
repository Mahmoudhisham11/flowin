import { db } from '@/lib/firestore'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getBudget } from './budgetService'
import { getPeriod, dayNumber, fromDayNumber } from '@/lib/planEngine'

/** The plan plus everything needed for the weekly and pay-period reports (about two pay periods back). */
export async function fetchReportData(uid, now = new Date()) {
  const budget = await getBudget(uid)
  if (!budget?.planVersion) return { budget, transactions: [] }

  const period = getPeriod(budget, now)
  const prevStart = getPeriod(budget, fromDayNumber(dayNumber(period.start) - 1)).start
  const earliest = Math.min(prevStart.getTime(), now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const since = new Date(earliest - 2 * 24 * 60 * 60 * 1000).toISOString()

  const snap = await getDocs(query(collection(db, `users/${uid}/transactions`), where('createdAt', '>=', since)))
  return { budget, transactions: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }
}
