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

function fromDayNumber(n) {
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
  return Number.isNaN(date.getTime()) ? null : date
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
