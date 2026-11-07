// Weekly / pay-period report. Pure: give it the plan, the transactions and "now".

import { getPeriod, computePlan, allocateSpending, dayNumber, fromDayNumber } from './planEngine.js'
import { WEAK_SPOTS } from './planPresets.js'

const round = (n) => Math.round(n)

/**
 * Splits every expense into the part that paid a fixed expense and the part that was free
 * spending, one pay period at a time (envelopes reset each period).
 */
export function allocateAcrossPeriods(config, transactions, toDay = (iso) => new Date(iso)) {
  const essentials = (config.essentialCategories || []).filter((e) => e && e.name)
  const groups = new Map()

  for (const tx of transactions || []) {
    if (!tx || tx.type !== 'expense' || !tx.createdAt) continue
    const when = toDay(tx.createdAt)
    if (!when || Number.isNaN(when.getTime())) continue
    const dayN = dayNumber(when)
    const periodStartN = dayNumber(getPeriod(config, when).start)
    if (!groups.has(periodStartN)) groups.set(periodStartN, [])
    groups.get(periodStartN).push({ ...tx, _dayN: dayN })
  }

  const entries = []
  for (const [periodStartN, list] of groups) {
    for (const e of allocateSpending(list, essentials)) {
      entries.push({ tx: e.tx, dayN: e.tx._dayN, periodStartN, absorbed: e.absorbed, free: e.free })
    }
  }
  return entries
}

function rangeStats(entries, incomes, startN, endN) {
  const days = endN - startN + 1
  const byDay = new Array(days).fill(0)
  const byCategory = {}
  let free = 0
  let essentialsPaid = 0
  let expenses = 0
  let count = 0

  for (const e of entries) {
    if (e.dayN < startN || e.dayN > endN) continue
    count += 1
    expenses += Number(e.tx.amount) || 0
    essentialsPaid += e.absorbed
    free += e.free
    byDay[e.dayN - startN] += e.free
    if (e.free > 0) {
      const cat = e.tx.category || 'Other'
      byCategory[cat] = (byCategory[cat] || 0) + e.free
    }
  }
  let income = 0
  for (const i of incomes) if (i.dayN >= startN && i.dayN <= endN) income += i.amount

  return { startN, endN, days, free, essentialsPaid, expenses, income, count, byDay, byCategory }
}

/**
 * kind: 'week'   last 7 days (including today) vs the 7 days before
 *       'period' the current pay period so far vs the previous pay period
 */
export function buildReport(config, transactions, { kind = 'week', now = new Date(), toDay = (iso) => new Date(iso) } = {}) {
  if (!config?.planVersion) return { hasPlan: false }

  const todayN = dayNumber(now)
  const period = getPeriod(config, now)
  const periodStartN = dayNumber(period.start)

  let curRange
  let prevRange
  if (kind === 'period') {
    curRange = [periodStartN, todayN]
    const prev = getPeriod(config, fromDayNumber(periodStartN - 1))
    prevRange = [dayNumber(prev.start), periodStartN - 1]
  } else {
    curRange = [todayN - 6, todayN]
    prevRange = [todayN - 13, todayN - 7]
  }

  const essentials = (config.essentialCategories || []).filter((e) => e && e.name)
  const sources = Array.isArray(config.incomeSources) && config.incomeSources.length > 0
    ? config.incomeSources
    : [{ amount: config.monthlyIncome }]
  const plan = computePlan({ incomeSources: sources, essentials, savingsPct: config.savingsPct }, period)
  const freePool = plan.freeSpend
  const baseDaily = freePool / period.totalDays

  const entries = allocateAcrossPeriods(config, transactions, toDay)
  const incomes = []
  for (const tx of transactions || []) {
    if (tx?.type !== 'income' || !tx.createdAt) continue
    const when = toDay(tx.createdAt)
    if (when && !Number.isNaN(when.getTime())) incomes.push({ dayN: dayNumber(when), amount: Number(tx.amount) || 0 })
  }

  const cur = rangeStats(entries, incomes, curRange[0], curRange[1])
  const prev = rangeStats(entries, incomes, prevRange[0], prevRange[1])

  const allowance = baseDaily * cur.days
  const ratio = allowance > 0 ? cur.free / allowance : null
  let rating = 'none'
  if (freePool > 0 && cur.count > 0) {
    rating = ratio <= 0.9 ? 'great' : ratio <= 1 ? 'good' : ratio <= 1.15 ? 'attention' : 'over'
  }

  const topCategories = Object.entries(cur.byCategory)
    .map(([category, amount]) => {
      const before = prev.byCategory[category] || 0
      return { category, amount, pct: cur.free > 0 ? (amount / cur.free) * 100 : 0, before, delta: amount - before }
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4)

  // Habits the user said drain their money (grouped by category so "coffee" and "eating out" do not double count).
  const weakCats = [...new Set((config.weakSpots || []).map((id) => WEAK_SPOTS.find((w) => w.id === id)?.categoryId).filter(Boolean))]
  const weakSpots = weakCats
    .map((category) => ({ category, amount: cur.byCategory[category] || 0 }))
    .filter((w) => w.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  const overDays = baseDaily > 0 ? cur.byDay.filter((v) => v > baseDaily).length : 0
  const noSpendDays = cur.byDay.filter((v) => v === 0).length
  let worstIdx = 0
  cur.byDay.forEach((v, i) => { if (v > cur.byDay[worstIdx]) worstIdx = i })
  const worst = cur.count > 0 ? { dayN: cur.startN + worstIdx, amount: cur.byDay[worstIdx] } : null

  let projection = null
  if (kind === 'period' && freePool > 0 && cur.days > 0) {
    const projected = (cur.free / cur.days) * period.totalDays
    projection = { projected, pool: freePool, over: Math.max(0, projected - freePool), pct: (projected / freePool) * 100 }
  }

  const unit = kind === 'period' ? 'period' : 'week'
  const insights = []
  if (cur.count === 0) {
    insights.push({ key: 'noData', params: {} })
  } else {
    if (projection && projection.pct > 105) {
      insights.push({ key: 'projectionOver', params: { projected: round(projection.projected), pool: round(freePool), over: round(projection.over) } })
    }
    if (prev.free > 0) {
      const pct = ((cur.free - prev.free) / prev.free) * 100
      if (pct <= -5) insights.push({ key: 'vsPrevDown', params: { pct: round(-pct), amount: round(prev.free - cur.free) } })
      else if (pct >= 5) insights.push({ key: 'vsPrevUp', params: { pct: round(pct), amount: round(cur.free - prev.free) } })
    }
    const top = topCategories[0]
    if (top) insights.push({ key: 'topCategory', category: top.category, params: { amount: round(top.amount), pct: round(top.pct) } })
    if (weakSpots[0]) insights.push({ key: 'weakSpot', category: weakSpots[0].category, params: { amount: round(weakSpots[0].amount) } })
    if (overDays >= 2) insights.push({ key: 'overDays', params: { days: overDays, of: cur.days } })
    if (top && top.amount > 0) insights.push({ key: 'cutTip', category: top.category, params: { amount: round(top.amount * 0.2), unit } })
    // Positive reinforcement comes last: the actionable tips matter more when space is limited.
    if (noSpendDays >= 2) insights.push({ key: 'noSpendDays', params: { days: noSpendDays } })
  }

  return {
    hasPlan: true,
    kind,
    unit,
    cur,
    prev,
    startDate: fromDayNumber(cur.startN),
    endDate: fromDayNumber(cur.endN),
    freePool,
    baseDaily,
    allowance,
    ratio,
    rating,
    topCategories,
    weakSpots,
    overDays,
    noSpendDays,
    worst: worst && worst.amount > 0 ? { ...worst, date: fromDayNumber(worst.dayN) } : null,
    projection,
    insights: insights.slice(0, 5),
  }
}
