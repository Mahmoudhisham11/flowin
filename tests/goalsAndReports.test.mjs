import test from 'node:test'
import assert from 'node:assert/strict'
import { goalProgress, emergencyFundTarget, goalsSummary, normalizeGoalInput } from '../lib/goalEngine.js'
import { buildReport, allocateAcrossPeriods } from '../lib/reportEngine.js'

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }

test('goal progress and pacing', () => {
  const now = d('2026-11-10')
  // 1000 target, 250 saved, due 2026-12-10 (30 days), created 2026-11-01
  let p = goalProgress({ targetAmount: 1000, savedAmount: 250, targetDate: '2026-12-10', createdAt: '2026-11-01T10:00:00' }, now, { periodDays: 30 })
  assert.equal(p.pct, 25); assert.equal(p.remaining, 750); assert.equal(p.daysLeft, 30)
  assert.equal(p.perDay, 25); assert.equal(p.perWeek, 175); assert.equal(p.perPeriod, 750)
  // expected pace: 9 of 39 days => 230.7 saved; we have 250 => on track
  assert.equal(p.status, 'onTrack'); assert.equal(p.behindBy, 0)

  p = goalProgress({ targetAmount: 1000, savedAmount: 0, targetDate: '2026-12-10', createdAt: '2026-11-01T10:00:00' }, now)
  assert.equal(p.status, 'behind'); assert.ok(p.behindBy > 200)

  assert.equal(goalProgress({ targetAmount: 500, savedAmount: 500 }, now).status, 'done')
  assert.equal(goalProgress({ targetAmount: 500, savedAmount: 900 }, now).pct, 100)
  assert.equal(goalProgress({ targetAmount: 500, savedAmount: 100, targetDate: '2026-11-01', createdAt: '2026-10-01T00:00:00' }, now).status, 'overdue')
  // due today: whole remaining amount is needed today
  p = goalProgress({ targetAmount: 100, savedAmount: 40, targetDate: '2026-11-10', createdAt: '2026-11-01T00:00:00' }, now)
  assert.equal(p.perDay, 60)

  // no date: estimate from the plan's savings
  p = goalProgress({ targetAmount: 10000, savedAmount: 1000 }, now, { periodDays: 30, savingsPerPeriod: 2100 })
  assert.equal(p.status, 'noDate'); assert.equal(p.etaPeriods, 5)
  assert.equal(p.etaDate.getFullYear(), 2027); assert.equal(p.etaDate.getMonth(), 3)  // 150 days after 10 Nov 2026 => 9 Apr 2027
  assert.equal(goalProgress({ targetAmount: 100, savedAmount: 0 }, now).etaDate, undefined)
  assert.equal(goalProgress({}, now).pct, 0)
})

test('emergency fund, summary and input validation', () => {
  const cfg = { payCycle: 'monthly', payDay: 1, essentialCategories: [{ name: 'Rent', amount: 6000 }, { name: 'Food', amount: 2000 }] }
  assert.equal(emergencyFundTarget(cfg, 3, d('2026-11-10')), 24000)   // 8000 per 30 days * 3 months
  assert.equal(emergencyFundTarget({ ...cfg, essentialCategories: [] }, 3, d('2026-11-10')), 0)
  assert.equal(emergencyFundTarget({ payCycle: 'weekly', lastPayDate: '2026-11-05', essentialCategories: [{ name: 'X', amount: 700 }] }, 3, d('2026-11-10')), 9000) // 100/day * 90

  const a = goalProgress({ targetAmount: 1000, savedAmount: 0, targetDate: '2026-12-10', createdAt: '2026-11-01T00:00:00' }, d('2026-11-10'), { periodDays: 30 })
  let s = goalsSummary([a], 500)
  assert.equal(s.requiredPerPeriod, 1000); assert.equal(s.shortfall, 500); assert.equal(s.overCommitted, true)
  s = goalsSummary([a], 2000); assert.equal(s.overCommitted, false); assert.equal(s.shortfall, 0)
  assert.equal(goalsSummary([], 1000).overCommitted, false)

  assert.deepEqual(normalizeGoalInput({ name: '  ', targetAmount: 5 }), { ok: false, error: 'name' })
  assert.deepEqual(normalizeGoalInput({ name: 'Car', targetAmount: 0 }), { ok: false, error: 'target' })
  assert.deepEqual(normalizeGoalInput({ name: 'Car', targetAmount: 5, targetDate: '2026-13-45' }), { ok: false, error: 'date' })
  const ok = normalizeGoalInput({ name: ' Laptop ', targetAmount: '12000.456', targetDate: '2027-01-01', kind: 'weird' })
  assert.equal(ok.ok, true); assert.equal(ok.goal.name, 'Laptop'); assert.equal(ok.goal.targetAmount, 12000.46); assert.equal(ok.goal.kind, 'purchase')
})

const cfg = {
  planVersion: 1, payCycle: 'monthly', payDay: 1, savingsPct: 15, incomeSources: [{ amount: 14000 }],
  weakSpots: ['food_out', 'coffee', 'smoking'],
  essentialCategories: [{ name: 'Rent', amount: 7000, presetId: 'rent' }, { name: 'Transport', amount: 500, categoryId: 'Transport', presetId: 'transport' }],
} // free money: 14000-7500-2100 = 4400 over 30 days => 146.67/day
const tx = (day, amount, category = 'Food', extra = {}) => ({ type: 'expense', amount, category, createdAt: `${day}T12:00:00`, ...extra })

test('allocation resets the fixed-expense envelopes every pay period', () => {
  const entries = allocateAcrossPeriods(cfg, [
    tx('2026-10-20', 500, 'Transport'), tx('2026-10-25', 300, 'Transport'),   // October: 500 absorbed, 300 free
    tx('2026-11-02', 500, 'Transport'),                                      // November: envelope is full again
  ])
  const free = entries.reduce((s, e) => s + e.free, 0)
  assert.equal(free, 300); assert.equal(entries.reduce((s, e) => s + e.absorbed, 0), 1000)
})

test('weekly report: totals, comparison, categories, insights', () => {
  const txs = [
    // previous week (Oct 30 - Nov 5): 600 free
    tx('2026-10-31', 400, 'Food'), tx('2026-11-03', 200, 'Shopping'),
    // this week (Nov 6 - Nov 12): 1500 free in 7 days (allowance 7 * 146.67 = 1026.7)
    tx('2026-11-06', 100, 'Food'), tx('2026-11-07', 700, 'Shopping'), tx('2026-11-08', 150, 'Food'),
    tx('2026-11-09', 200, 'Smoking'), tx('2026-11-11', 350, 'Food'),
    { type: 'income', amount: 500, createdAt: '2026-11-10T09:00:00' },
    tx('2026-11-12', 7000, 'Bills', { essentialKey: 'rent' }),               // fixed expense: not free spending
  ]
  const r = buildReport(cfg, txs, { kind: 'week', now: d('2026-11-12') })
  assert.equal(r.hasPlan, true); assert.equal(r.cur.days, 7)
  assert.equal(r.cur.free, 1500); assert.equal(r.cur.essentialsPaid, 7000); assert.equal(r.cur.income, 500)
  assert.equal(r.prev.free, 600)
  assert.equal(Math.round(r.allowance), 1027); assert.equal(r.rating, 'over')           // 1.46 > 1.15
  assert.equal(r.topCategories[0].category, 'Shopping'); assert.equal(r.topCategories[0].amount, 700)
  assert.equal(r.topCategories[0].before, 200); assert.equal(r.topCategories[0].delta, 500)
  assert.deepEqual(r.weakSpots.map((w) => [w.category, w.amount]), [['Food', 600], ['Smoking', 200]])
  assert.equal(r.overDays, 4); assert.equal(r.noSpendDays, 2)                           // Nov 10 and Nov 12 had no free spending
  assert.equal(r.worst.amount, 700); assert.equal(r.worst.date.getDate(), 7)
  const keys = r.insights.map((i) => i.key)
  assert.ok(keys.includes('overDays') && keys.includes('vsPrevUp') && keys.includes('topCategory') && keys.includes('weakSpot') && keys.includes('cutTip'))
  assert.equal(keys.length, 5); assert.equal(r.noSpendDays, 2)
  assert.equal(r.insights.find((i) => i.key === 'vsPrevUp').params.pct, 150)
  assert.equal(r.insights.find((i) => i.key === 'cutTip').params.amount, 140)           // 20% of 700
  assert.equal(r.projection, null)
})

test('pay-period report: projection, previous period, ratings, empty states', () => {
  const txs = [
    tx('2026-10-05', 1000, 'Food'),                                         // previous period (October)
    tx('2026-11-01', 400, 'Food'), tx('2026-11-02', 400, 'Shopping'), tx('2026-11-03', 400, 'Food'),
  ]
  const r = buildReport(cfg, txs, { kind: 'period', now: d('2026-11-03') })
  assert.equal(r.cur.days, 3); assert.equal(r.cur.free, 1200); assert.equal(r.prev.days, 31); assert.equal(r.prev.free, 1000)
  assert.equal(Math.round(r.projection.projected), 12000)               // 400/day over 30 days
  assert.equal(r.insights[0].key, 'projectionOver')
  assert.equal(r.rating, 'over')

  const calm = buildReport(cfg, [tx('2026-11-01', 100, 'Food')], { kind: 'period', now: d('2026-11-03') })
  assert.equal(calm.rating, 'great')

  const empty = buildReport(cfg, [], { kind: 'week', now: d('2026-11-12') })
  assert.equal(empty.rating, 'none'); assert.deepEqual(empty.insights, [{ key: 'noData', params: {} }])
  assert.equal(empty.worst, null)
  assert.deepEqual(buildReport(null, [], {}), { hasPlan: false })
  assert.deepEqual(buildReport({ monthlyIncome: 5 }, [], {}), { hasPlan: false })
})
