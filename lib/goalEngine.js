// Pure savings-goal logic. A goal is { name, targetAmount, savedAmount, targetDate?: 'YYYY-MM-DD',
// createdAt: ISO, kind?: 'emergency' | 'purchase' }. Nothing here touches Firebase or React.

import { dayNumber, parseDateStr, getPeriod } from './planEngine.js'

const DAY_MS = 86_400_000
const round = (n) => Math.round(n)

/**
 * Progress and pacing of one goal.
 * periodDays: length of the user's pay period (to express the required saving per period).
 * savingsPerPeriod: what the plan sets aside each period (used for a "reach it by" estimate).
 */
export function goalProgress(goal, now = new Date(), { periodDays = 30, savingsPerPeriod = 0 } = {}) {
  const target = Math.max(0, Number(goal?.targetAmount) || 0)
  const saved = Math.max(0, Number(goal?.savedAmount) || 0)
  const remaining = Math.max(0, target - saved)
  const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0
  const done = target > 0 && remaining <= 0

  const out = { target, saved, remaining, pct, done, status: done ? 'done' : 'noDate' }
  if (done) return out

  // Estimated finish date if the user keeps setting aside the plan's savings each period.
  if (savingsPerPeriod > 0 && remaining > 0) {
    const periods = Math.ceil(remaining / savingsPerPeriod)
    out.etaPeriods = periods
    out.etaDate = new Date(dayNumber(now) * DAY_MS + periods * periodDays * DAY_MS)
    out.etaDate = new Date(out.etaDate.getUTCFullYear(), out.etaDate.getUTCMonth(), out.etaDate.getUTCDate())
  }

  const targetDate = parseDateStr(goal?.targetDate)
  if (!targetDate) return out

  const daysLeft = dayNumber(targetDate) - dayNumber(now)
  out.daysLeft = daysLeft
  out.targetDate = targetDate

  if (daysLeft < 0) {
    out.status = 'overdue'
    return out
  }

  const perDay = remaining / Math.max(1, daysLeft)
  out.perDay = perDay
  out.perWeek = perDay * 7
  out.perPeriod = perDay * periodDays

  // Compare with an even pace from the day the goal was created to its target date.
  const created = goal?.createdAt ? new Date(goal.createdAt) : null
  const startN = created && !Number.isNaN(created.getTime()) ? dayNumber(created) : null
  const endN = dayNumber(targetDate)
  if (startN !== null && endN > startN) {
    const frac = Math.min(1, Math.max(0, (dayNumber(now) - startN) / (endN - startN)))
    const expected = target * frac
    out.expectedSaved = expected
    out.behindBy = Math.max(0, expected - saved)
    out.status = out.behindBy > target * 0.1 ? 'behind' : 'onTrack'
  } else {
    out.status = 'onTrack'
  }
  return out
}

/** Three months of fixed expenses, the usual size of an emergency fund (rounded to 50). */
export function emergencyFundTarget(config, months = 3, now = new Date()) {
  const essentials = (config?.essentialCategories || []).reduce((s, e) => s + (Number(e.amount) > 0 ? Number(e.amount) : 0), 0)
  if (essentials <= 0) return 0
  const period = getPeriod(config, now)
  const perDay = essentials / period.totalDays
  return Math.max(50, Math.round((perDay * 30 * months) / 50) * 50)
}

/**
 * Do the goals ask for more than the plan sets aside?
 * progressList: array of goalProgress() results for the active (not done) goals.
 */
export function goalsSummary(progressList, savingsPerPeriod) {
  const required = progressList.reduce((s, p) => s + (p.perPeriod || 0), 0)
  return {
    requiredPerPeriod: round(required),
    savingsPerPeriod: round(savingsPerPeriod || 0),
    shortfall: round(Math.max(0, required - (savingsPerPeriod || 0))),
    overCommitted: required > (savingsPerPeriod || 0) && required > 0,
  }
}

/** Validates user input for creating/editing a goal. Returns { ok, goal?, error? }. */
export function normalizeGoalInput(input) {
  const name = String(input?.name ?? '').trim().slice(0, 60)
  const target = Number(input?.targetAmount)
  if (!name) return { ok: false, error: 'name' }
  if (!Number.isFinite(target) || target <= 0) return { ok: false, error: 'target' }
  const date = input?.targetDate ? String(input.targetDate) : ''
  if (date && !parseDateStr(date)) return { ok: false, error: 'date' }
  return {
    ok: true,
    goal: {
      name,
      emoji: String(input?.emoji || '🎯').slice(0, 8),
      kind: input?.kind === 'emergency' ? 'emergency' : 'purchase',
      targetAmount: Math.round(target * 100) / 100,
      targetDate: date || null,
    },
  }
}
