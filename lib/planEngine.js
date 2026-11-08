import { findMatchingCategory, normalizeArabic } from './budgetMatch.js'

// Pure budget-plan logic (no Firebase, no React) so it can be unit-tested and shared by
// onboarding, the dashboard and the AI context.
//
// Concepts
//  - A "pay period" is the span between two paydays (monthly, biweekly or weekly).
//  - income - essentials - savings = free spending money for the period.
//  - All amounts the user enters are per pay period.

export const PAY_CYCLES = ['monthly', 'biweekly', 'weekly']
export const INCOME_TYPES = ['fixed', 'variable']

const DAY_MS = 86_400_000

// ---- date helpers (calendar days, DST-safe: everything is a UTC day number) ----------------

export function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

export function fromDayNumber(n) {
  const d = new Date(n * DAY_MS)
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateStr(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''))
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  // Reject dates that JavaScript would silently roll over (e.g. 2026-13-45).
  const valid =
    date.getFullYear() === Number(m[1]) && date.getMonth() === Number(m[2]) - 1 && date.getDate() === Number(m[3])
  return valid ? date : null
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

// Payday for a given month; a 31st payday falls on the last day of shorter months.
function monthlyPayDate(year, monthIndex, payDay) {
  return new Date(year, monthIndex, Math.min(payDay, daysInMonth(year, monthIndex)))
}

// ---- pay period ----------------------------------------------------------------------------

/**
 * The pay period containing `today`.
 * plan: { payCycle, payDay (1-31, monthly), lastPayDate ('YYYY-MM-DD', weekly/biweekly) }
 * Returns { start, end (exclusive), startStr, endStr, totalDays, dayIndex (0-based), daysElapsed, daysLeft }
 * daysLeft counts today (the last day of a period has daysLeft = 1).
 */
export function getPeriod(plan, today = new Date()) {
  const cycle = PAY_CYCLES.includes(plan?.payCycle) ? plan.payCycle : 'monthly'
  const todayN = dayNumber(today)

  let startN
  let endN

  if (cycle === 'monthly') {
    const payDay = Math.min(31, Math.max(1, Math.floor(Number(plan?.payDay)) || 1))
    let start = monthlyPayDate(today.getFullYear(), today.getMonth(), payDay)
    if (dayNumber(start) > todayN) {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      start = monthlyPayDate(prev.getFullYear(), prev.getMonth(), payDay)
    }
    const nextBase = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    startN = dayNumber(start)
    endN = dayNumber(monthlyPayDate(nextBase.getFullYear(), nextBase.getMonth(), payDay))
  } else {
    const step = cycle === 'weekly' ? 7 : 14
    const anchor = parseDateStr(plan?.lastPayDate) || today
    const anchorN = dayNumber(anchor)
    startN = anchorN + Math.floor((todayN - anchorN) / step) * step
    endN = startN + step
  }

  const totalDays = endN - startN
  const daysElapsed = todayN - startN
  return {
    start: fromDayNumber(startN),
    end: fromDayNumber(endN),
    startStr: toDateStr(fromDayNumber(startN)),
    endStr: toDateStr(fromDayNumber(endN)),
    totalDays,
    dayIndex: daysElapsed,
    daysElapsed,
    daysLeft: totalDays - daysElapsed,
  }
}

// ---- allocation ----------------------------------------------------------------------------

const sum = (items) =>
  (items || []).reduce((total, item) => {
    const n = Number(item?.amount)
    return total + (Number.isFinite(n) && n > 0 ? n : 0)
  }, 0)

/** Suggested savings % given how much of the income the essentials already use. */
export function recommendSavingsPct(income, essentials) {
  if (!(income > 0) || essentials >= income) return 0
  const ratio = essentials / income
  if (ratio > 0.85) return 5
  if (ratio > 0.7) return 10
  return 15
}

/**
 * Splits the income of one pay period.
 * input: { incomeSources: [{amount}], essentials: [{amount}], savingsPct: 0-100 }
 * period: result of getPeriod() (supplies the number of days)
 */
export function computePlan({ incomeSources, essentials, savingsPct }, period) {
  const income = sum(incomeSources)
  const essentialsTotal = sum(essentials)
  const pct = Math.min(100, Math.max(0, Number(savingsPct) || 0))
  const savings = Math.round((income * pct) / 100)
  const free = income - essentialsTotal - savings
  const days = Math.max(1, period?.totalDays || 30)

  const warnings = []
  if (!(income > 0)) warnings.push('noIncome')
  else if (essentialsTotal >= income) warnings.push('essentialsExceedIncome')
  else if (free < 0) warnings.push('savingsTooHigh')
  else if (free < income * 0.1) warnings.push('tight')

  const dailyAllowance = free > 0 ? free / days : 0

  return {
    income,
    essentials: essentialsTotal,
    savingsPct: pct,
    savings,
    free,
    freeSpend: Math.max(0, free),
    days,
    dailyAllowance,
    weeklyAllowance: dailyAllowance * 7,
    warnings,
    ok: warnings.length === 0 || warnings[0] === 'tight',
  }
}

// ---- spending allocation & "safe to spend today" ---------------------------------------------
//
// Every expense is split between the fixed expenses (essentials) it pays for and the user's
// free spending money. An expense pays for an essential when it was tagged with one
// (tx.essentialKey = presetId or name) or when its category matches the essential
// (e.g. category Transport -> "Transport"). It only absorbs up to that essential's amount for the
// period; whatever goes beyond it (or has no matching essential) is free spending.

function findEssentialIndex(essentials, tx) {
  if (tx.essentialKey) {
    const key = normalizeArabic(tx.essentialKey)
    const i = essentials.findIndex(
      (e) => (e.presetId && e.presetId === tx.essentialKey) || normalizeArabic(e.name || '') === key
    )
    if (i !== -1) return i
  }
  if (tx.category) {
    const match = findMatchingCategory(essentials, tx.category)
    if (match) return essentials.indexOf(match)
  }
  return -1
}

/** expenses must already be limited to one pay period. Returns one entry per expense. */
export function allocateSpending(expenses, essentials) {
  const remaining = essentials.map((e) => Math.max(0, Number(e.amount) || 0))
  const ordered = [...expenses].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))

  return ordered.map((tx) => {
    const amount = Math.max(0, Number(tx.amount) || 0)
    const i = findEssentialIndex(essentials, tx)
    let absorbed = 0
    if (i !== -1) {
      absorbed = Math.min(remaining[i], amount)
      remaining[i] -= absorbed
    }
    return { tx, essentialIndex: i, absorbed, free: amount - absorbed }
  })
}

const round = (n) => Math.round(n)

/**
 * Everything the "Today" screen needs.
 * config: the budget document (payCycle, payDay, lastPayDate, incomeSources/monthlyIncome,
 *         essentialCategories, savingsPct, planVersion)
 * now:    a Date whose local Y/M/D is the user's current day
 * toDay:  (createdAtIso) => Date whose local Y/M/D is the user's day of that transaction
 * opts.walletsTotal: the money the user really has right now (sum of wallet balances). When given,
 *         today's amount never exceeds what that money allows until payday, after the fixed
 *         expenses still due this period (config.fixedPaid marks the ones already paid).
 */
export function computeToday(config, transactions, now = new Date(), toDay = (iso) => new Date(iso), opts = {}) {
  if (!config || !config.planVersion) return { hasPlan: false }

  const period = getPeriod(config, now)
  const startN = dayNumber(period.start)
  const essentials = (config.essentialCategories || []).filter((e) => e && e.name)
  const sources = Array.isArray(config.incomeSources) && config.incomeSources.length > 0
    ? config.incomeSources
    : [{ amount: config.monthlyIncome }]

  const plan = computePlan({ incomeSources: sources, essentials, savingsPct: config.savingsPct }, period)
  const freePool = plan.freeSpend
  const totalDays = period.totalDays
  const dayIndex = period.dayIndex
  const daysLeft = period.daysLeft

  const inPeriod = []
  let expenseToday = 0
  let incomeToday = 0
  for (const tx of transactions || []) {
    if (!tx || !tx.createdAt) continue
    const when = toDay(tx.createdAt)
    if (!when || Number.isNaN(when.getTime())) continue
    const d = dayNumber(when) - startN
    if (d < 0 || d > dayIndex) continue
    if (d === dayIndex) {
      if (tx.type === 'expense') expenseToday += Math.max(0, Number(tx.amount) || 0)
      if (tx.type === 'income') incomeToday += Math.max(0, Number(tx.amount) || 0)
    }
    if (tx.type === 'expense') inPeriod.push({ ...tx, _d: d })
  }

  const allocated = allocateSpending(inPeriod, essentials)

  const freeByDay = new Array(dayIndex + 1).fill(0)
  const essentialSpent = essentials.map(() => 0)
  const byCategory = {}
  let essentialsPaid = 0
  let absorbedToday = 0
  allocated.forEach(({ tx, essentialIndex, absorbed, free }) => {
    freeByDay[tx._d] += free
    if (essentialIndex !== -1) {
      essentialSpent[essentialIndex] += absorbed
      essentialsPaid += absorbed
      if (tx._d === dayIndex) absorbedToday += absorbed
    }
    if (free > 0) {
      const cat = tx.category || 'Other'
      byCategory[cat] = (byCategory[cat] || 0) + free
    }
  })

  const spentToday = freeByDay[dayIndex]
  const spentBeforeToday = freeByDay.slice(0, dayIndex).reduce((a, b) => a + b, 0)
  const spentTotal = spentBeforeToday + spentToday
  const poolRemaining = freePool - spentTotal

  const baseDaily = freePool / totalDays
  const planAllowance = Math.max(0, (freePool - spentBeforeToday) / daysLeft)

  // Fixed expenses still to pay this period: not covered by logged payments and not marked as paid.
  const paidKeys = config.fixedPaid && config.fixedPaid.periodStart === period.startStr
    ? new Set(config.fixedPaid.keys || [])
    : new Set()
  const essentialsDue = essentials.map((e, i) => {
    const key = e.presetId || e.name
    const amount = Math.max(0, Number(e.amount) || 0)
    const paid = paidKeys.has(key)
    return { key, name: e.name, amount, spent: essentialSpent[i], paid, due: paid ? 0 : Math.max(0, amount - essentialSpent[i]) }
  })
  const dueNow = essentialsDue.reduce((sum, e) => sum + e.due, 0)

  // Real money: never suggest spending more than what is actually left until payday.
  let todayAllowance = planAllowance
  let effectivePool = poolRemaining
  let limitedBy = 'plan'
  let cash = null
  const walletsTotal = Number(opts.walletsTotal)
  if (opts.walletsTotal !== undefined && opts.walletsTotal !== null && Number.isFinite(walletsTotal)) {
    const spendableNow = walletsTotal - dueNow
    // Wallet balances already include today's movements, so rebuild the start-of-day position.
    const startCash = walletsTotal + expenseToday - incomeToday
    const dueAtStart = dueNow + absorbedToday
    const cashAllowance = Math.max(0, (startCash - dueAtStart) / daysLeft)
    cash = {
      walletsTotal,
      dueNow,
      spendableNow,
      cashAllowance,
      planAllowance,
      cashDaily: Math.max(0, spendableNow) / daysLeft,
      gap: poolRemaining - spendableNow, // > 0: the plan expects more money than you have
    }
    if (cashAllowance < planAllowance) {
      limitedBy = 'cash'
      todayAllowance = cashAllowance
      effectivePool = Math.min(poolRemaining, spendableNow)
    }
  }

  const remainingToday = todayAllowance - spentToday
  const tomorrowAllowance = daysLeft > 1 ? Math.max(0, effectivePool / (daysLeft - 1)) : 0

  const weekIndex = Math.floor(dayIndex / 7)
  const weekStart = weekIndex * 7
  const weekEnd = Math.min(totalDays, weekStart + 7)
  const weekBudget = baseDaily * (weekEnd - weekStart)
  const weekSpent = freeByDay.slice(weekStart, weekEnd).reduce((a, b) => a + b, 0)

  // How much less than the even-pace plan was spent before today (negative = behind plan).
  const aheadOfPlan = baseDaily * dayIndex - spentBeforeToday

  const usedPct = freePool > 0 ? (spentTotal / freePool) * 100 : 0
  const elapsedPct = ((dayIndex + 1) / totalDays) * 100

  let status = 'ok'
  if (freePool <= 0) status = 'none'
  else if (effectivePool <= 0) status = 'depleted'
  else if (remainingToday < 0) status = 'over'
  else if (todayAllowance > 0 && remainingToday < todayAllowance * 0.2) status = 'caution'

  const topLeaks = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)

  const state = {
    hasPlan: true,
    status,
    period,
    plan,
    freePool,
    baseDaily,
    todayAllowance,
    spentToday,
    remainingToday,
    tomorrowAllowance,
    spentTotal,
    poolRemaining: effectivePool,
    planPoolRemaining: poolRemaining,
    planAllowance,
    limitedBy,
    cash,
    essentialsDue,
    dueNow,
    aheadOfPlan,
    usedPct,
    elapsedPct,
    daysLeft,
    totalDays,
    dayIndex,
    weekBudget,
    weekSpent,
    weekLength: weekEnd - weekStart,
    weekStartIndex: weekStart,
    weekDays: freeByDay.slice(weekStart, Math.min(weekEnd, dayIndex + 1)),
    essentialsPaid,
    essentialSpent,
    topLeaks,
  }
  state.coach = coachMessage(state)
  return state
}

/** The one sentence the coach shows. The UI looks `key` up in the translations. */
export function coachMessage(s) {
  if (!s.hasPlan) return null
  if (s.freePool <= 0) return { key: 'noFreeMoney', params: {} }
  if (s.cash && s.cash.dueNow > 0 && s.cash.spendableNow < 0) {
    return { key: 'cantCoverFixed', params: { due: round(s.cash.dueNow), cash: round(Math.max(0, s.cash.walletsTotal)), days: s.daysLeft } }
  }
  if (s.poolRemaining <= 0) {
    return { key: 'depleted', params: { days: s.daysLeft, over: round(Math.abs(s.poolRemaining)) } }
  }
  if (s.remainingToday < 0) {
    return {
      key: 'overToday',
      params: { over: round(-s.remainingToday), tomorrow: round(s.tomorrowAllowance), days: s.daysLeft },
    }
  }
  if (s.status === 'caution') return { key: 'nearLimit', params: { left: round(s.remainingToday) } }
  if (s.limitedBy === 'cash') {
    return {
      key: 'cashLimited',
      params: { cash: round(Math.max(0, s.cash.spendableNow)), days: s.daysLeft, daily: round(s.todayAllowance), plan: round(s.planAllowance) },
    }
  }
  if (s.dayIndex >= 2 && s.usedPct > s.elapsedPct + 15) {
    return { key: 'aheadOfPace', params: { used: round(s.usedPct), elapsed: round(s.elapsedPct) } }
  }
  if (s.daysLeft === 1) return { key: 'lastDay', params: { amount: round(s.remainingToday) } }
  if (s.dayIndex >= 1 && s.aheadOfPlan >= s.baseDaily * 0.5) {
    return { key: 'bankedExtra', params: { amount: round(s.aheadOfPlan), left: round(s.remainingToday) } }
  }
  return { key: 'onTrack', params: { amount: round(s.remainingToday), days: s.daysLeft } }
}
