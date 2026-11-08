import { computeToday, computePlan, getPeriod, dayNumber, fromDayNumber } from './planEngine'
import { buildReport } from './reportEngine'
import { goalProgress } from './goalEngine'
import { userDay, localDateStr } from './timezone'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Reads everything the AI manager needs for one user with the Admin SDK and returns the inputs
 * for formatChatContext(). Runs server-side only; the browser never supplies financial data.
 */
export async function loadChatData(db, uid, userData, tz, now = new Date()) {
  const base = `users/${uid}`
  const [budgetSnap, walletsSnap, goalsSnap, tasksSnap] = await Promise.all([
    db.doc(`${base}/budget/config`).get(),
    db.collection(`${base}/wallets`).get(),
    db.collection(`${base}/goals`).get(),
    db.collection(`${base}/dailyTasks`).limit(300).get(),
  ])

  const budget = budgetSnap.exists ? budgetSnap.data() : null
  const wallets = walletsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const goalsRaw = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const todayDate = userDay(tz, now)
  const hasPlan = Boolean(budget?.planVersion)

  // Transactions: this + previous pay period for plan users (reports need both), else 30 days.
  let sinceMs = now.getTime() - 30 * DAY_MS
  if (hasPlan) {
    const period = getPeriod(budget, todayDate)
    const prevStart = getPeriod(budget, fromDayNumber(dayNumber(period.start) - 1)).start
    sinceMs = Math.min(prevStart.getTime(), now.getTime() - 14 * DAY_MS)
  }
  const since = new Date(sinceMs - 2 * DAY_MS).toISOString()
  const txSnap = await db.collection(`${base}/transactions`).where('createdAt', '>=', since).get()
  const txs = txSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const toDay = (iso) => userDay(tz, new Date(iso))

  const essentials = (budget?.essentialCategories || []).filter((e) => e && e.name)
  const today = hasPlan ? computeToday(budget, txs, todayDate, toDay) : null
  const week = hasPlan ? buildReport(budget, txs, { kind: 'week', now: todayDate, toDay }) : null

  let periodDays = 30
  let savingsPerPeriod = 0
  if (hasPlan) {
    const period = getPeriod(budget, todayDate)
    periodDays = period.totalDays
    const sources = budget.incomeSources?.length ? budget.incomeSources : [{ amount: budget.monthlyIncome }]
    savingsPerPeriod = computePlan({ incomeSources: sources, essentials, savingsPct: budget.savingsPct }, period).savings
  }
  const goals = goalsRaw
    .map((g) => ({ name: g.name, p: goalProgress(g, todayDate, { periodDays, savingsPerPeriod }) }))
    .filter((g) => !g.p.done)
    .slice(0, 8)

  const recent = [...txs]
    .filter((t) => t.createdAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 12)
    .map((t) => ({
      date: localDateStr(tz, new Date(t.createdAt)),
      type: t.type,
      category: t.category,
      amount: Number(t.amount) || 0,
      reason: t.reason,
      merchant: t.merchant,
    }))

  let totals30 = null
  if (!hasPlan) {
    const cutoff = now.getTime() - 30 * DAY_MS
    const byCategory = {}
    let spent = 0
    let income = 0
    for (const t of txs) {
      if (!t.createdAt || new Date(t.createdAt).getTime() < cutoff) continue
      const amount = Number(t.amount) || 0
      if (t.type === 'expense') { spent += amount; const c = t.category || 'Other'; byCategory[c] = (byCategory[c] || 0) + amount }
      if (t.type === 'income') income += amount
    }
    totals30 = { spent, income, byCategory }
  }

  const todayStr = localDateStr(tz, now)
  const tasksAll = tasksSnap.docs.map((d) => d.data())
  const todayTasks = tasksAll.filter((t) => t.date === todayStr)
  const tasks = tasksAll.length
    ? {
        todayTotal: todayTasks.length,
        todayDone: todayTasks.filter((t) => t.completed).length,
        overdue: tasksAll.filter((t) => !t.completed && t.date < todayStr).length,
        todayItems: todayTasks,
      }
    : null

  return { todayStr, essentials, today, week, wallets, goals, recent, totals30, tasks }
}
