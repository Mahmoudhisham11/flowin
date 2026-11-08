import test from 'node:test'
import assert from 'node:assert/strict'
import { computeToday } from '../lib/planEngine.js'

test('allocation of spending and the safe-to-spend-today engine', () => {
  const d = (s) => { const [y,m,dd]=s.split('-').map(Number); return new Date(y,m-1,dd) }
  const tx = (day, amount, category='Other', extra={}) => ({ type:'expense', amount, category, createdAt: `${day}T12:00:00`, ...extra })
  const cfg = {
    planVersion: 1, payCycle: 'monthly', payDay: 1, monthlyIncome: 14000, savingsPct: 15,
    incomeSources: [{ name:'Salary', amount: 14000 }],
    essentialCategories: [
      { name: 'Rent / Housing', amount: 6000, presetId: 'rent' },
      { name: 'Transport', amount: 1000, categoryId: 'Transport', presetId: 'transport' },
    ],
  }
  // 14000 - 7000 - 2100 = 4900 free over 30 days (November)
  let r = computeToday(cfg, [], d('2026-11-01'))
  assert.equal(r.freePool, 4900); assert.equal(r.totalDays, 30); assert.equal(r.daysLeft, 30)
  assert.equal(Math.round(r.todayAllowance), 163); assert.equal(r.status, 'ok'); assert.equal(r.coach.key, 'onTrack')

  // day 1 (index 0): spend 100 Food -> free 100, remaining 63
  r = computeToday(cfg, [tx('2026-11-01', 100, 'Food')], d('2026-11-01'))
  assert.equal(r.spentToday, 100); assert.equal(Math.round(r.remainingToday), 63)

  // transport absorbs up to its envelope (1000), rest is free
  r = computeToday(cfg, [tx('2026-11-01', 800, 'Transport'), tx('2026-11-02', 500, 'Transport')], d('2026-11-02'))
  assert.equal(r.essentialsPaid, 1000); assert.equal(r.spentTotal, 300); assert.equal(r.spentToday, 300)
  assert.equal(r.essentialSpent[1], 1000)

  // rent logged under "Bills" with an essentialKey absorbs into Rent, not free money
  r = computeToday(cfg, [tx('2026-11-01', 6000, 'Bills', { essentialKey: 'rent' })], d('2026-11-01'))
  assert.equal(r.spentToday, 0); assert.equal(r.essentialSpent[0], 6000)
  // without the tag it is free spending (and blows the day)
  r = computeToday(cfg, [tx('2026-11-01', 6000, 'Bills')], d('2026-11-01'))
  assert.equal(r.status, 'depleted'); assert.equal(r.coach.key, 'depleted')
  // essentialKey by name (custom/voice), Arabic normalisation
  const cfgAr = { ...cfg, essentialCategories: [{ name: 'إيجار', amount: 3000 }], incomeSources:[{amount:10000}], savingsPct:10 }
  r = computeToday(cfgAr, [tx('2026-11-01', 3000, 'Other', { essentialKey: 'ايجار' })], d('2026-11-01'))
  assert.equal(r.spentToday, 0)

  // rolling: underspend yesterday raises today's amount, overspend lowers it
  r = computeToday(cfg, [tx('2026-11-01', 0, 'Food')], d('2026-11-02')); // nothing spent on day 1
  assert.ok(r.todayAllowance > 163 && Math.abs(r.todayAllowance - 4900/29) < 1e-9); assert.equal(r.coach.key, 'bankedExtra'); assert.equal(r.coach.params.amount, 163)
  r = computeToday(cfg, [tx('2026-11-01', 1000, 'Food')], d('2026-11-02'))
  assert.ok(Math.abs(r.todayAllowance - 3900/29) < 1e-9)
  // over today -> coach says how much and what tomorrow becomes
  r = computeToday(cfg, [tx('2026-11-01', 163, 'Food'), tx('2026-11-02', 400, 'Food')], d('2026-11-02'))
  assert.equal(r.status, 'over'); assert.equal(r.coach.key, 'overToday')
  assert.equal(r.coach.params.over, Math.round(400 - (4900-163)/29))
  assert.ok(Math.abs(r.tomorrowAllowance - (4900-563)/28) < 1e-9)
  // pool exhausted
  r = computeToday(cfg, [tx('2026-11-03', 5000, 'Shopping')], d('2026-11-03'))
  assert.equal(r.status, 'depleted'); assert.equal(Math.round(r.todayAllowance), 175); assert.ok(r.remainingToday < 0); assert.equal(r.coach.params.over, 100)
  // ahead of pace (not over today): spent 40% in first 3 days, today within allowance
  r = computeToday(cfg, [tx('2026-11-01', 1500, 'Food'), tx('2026-11-02', 500, 'Food')], d('2026-11-03'))
  assert.equal(r.coach.key, 'aheadOfPace')
  // last day of the period
  r = computeToday(cfg, [], d('2026-11-30')); assert.equal(r.daysLeft, 1)
  assert.equal(r.coach.key === 'lastDay' || r.coach.key === 'bankedExtra', true)

  // ignores income/transfers, other periods, and future-dated
  r = computeToday(cfg, [
    { type:'income', amount: 9999, createdAt:'2026-11-01T10:00:00' },
    { type:'transfer', amount: 500, createdAt:'2026-11-01T10:00:00' },
    tx('2026-10-31', 700, 'Food'),   // previous period (payDay 1)
    tx('2026-11-20', 700, 'Food'),   // future relative to "today"
    tx('2026-11-01', 50, 'Food'),
  ], d('2026-11-05'))
  assert.equal(r.spentTotal, 50)

  // weekly budget slices
  r = computeToday(cfg, [tx('2026-11-02', 100, 'Food'), tx('2026-11-09', 300, 'Food')], d('2026-11-09')) // day index 8 -> week 1
  assert.equal(r.weekLength, 7); assert.equal(r.weekSpent, 300); assert.ok(Math.abs(r.weekBudget - 4900/30*7) < 1e-9)
  // per-day free spending of the current week (days still to come are not included)
  r = computeToday(cfg, [tx('2026-11-02', 100, 'Food'), tx('2026-11-03', 50, 'Food')], d('2026-11-04'))
  assert.deepEqual(r.weekDays, [0, 100, 50, 0]); assert.equal(r.weekStartIndex, 0)
  r = computeToday(cfg, [tx('2026-11-09', 300, 'Food')], d('2026-11-09')); assert.equal(r.weekStartIndex, 7); assert.deepEqual(r.weekDays, [0, 300])
  // last (short) week of a 30-day period = 2 days
  r = computeToday(cfg, [], d('2026-11-29')); assert.equal(r.weekLength, 2)

  // no free money / no plan
  r = computeToday({ ...cfg, savingsPct: 15, essentialCategories: [{ name:'X', amount: 13000 }] }, [], d('2026-11-05'))
  assert.equal(r.status, 'none'); assert.equal(r.coach.key, 'noFreeMoney'); assert.equal(r.todayAllowance, 0)
  assert.deepEqual(computeToday(null, [], d('2026-11-05')), { hasPlan:false })
  assert.deepEqual(computeToday({ monthlyIncome: 5000 }, [], d('2026-11-05')), { hasPlan:false })  // legacy budget (no plan)

  // weekly pay cycle
  const wk = { planVersion:1, payCycle:'weekly', lastPayDate:'2026-11-05', incomeSources:[{amount:3500}], essentialCategories:[{name:'Rent',amount:1000}], savingsPct:15 }
  r = computeToday(wk, [tx('2026-11-06', 100, 'Food')], d('2026-11-07'))
  assert.equal(r.totalDays, 7); assert.equal(r.daysLeft, 5); assert.equal(r.freePool, 1975)
  assert.ok(Math.abs(r.todayAllowance - (1975-100)/5) < 1e-9)

  // timezone mapper: a UTC instant that is the next calendar day in the user's timezone
  const toDay = (iso) => { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date(iso)); return d(parts) }
  r = computeToday(cfg, [{ type:'expense', amount:100, category:'Food', createdAt:'2026-11-04T22:30:00Z' }], d('2026-11-05'), toDay) // 00:30 on the 5th in Cairo
  assert.equal(r.spentToday, 100)
  // caution: little left today but still ahead of plan overall -> warn about today, not "ahead of plan"
  r = computeToday(cfg, [tx('2026-11-05', 160, 'Food')], d('2026-11-05'))
  assert.equal(r.status, 'caution'); assert.equal(r.coach.key, 'nearLimit'); assert.equal(r.coach.params.left, 28)

})

test('real money: today never exceeds what the wallets allow until payday', () => {
  const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }
  const tx = (day, amount, category = 'Other', extra = {}) => ({ type: 'expense', amount, category, createdAt: `${day}T12:00:00`, ...extra })
  const cfg = {
    planVersion: 1, payCycle: 'monthly', payDay: 1, savingsPct: 15, incomeSources: [{ amount: 14000 }],
    essentialCategories: [{ name: 'Rent', amount: 6000, presetId: 'rent' }, { name: 'Bills', amount: 1000, presetId: 'bills', categoryId: 'Bills' }],
  } // plan: 4900 free / 30 days in November

  // Day 8, only 800 left in the wallets, rent and bills already paid (marked) -> 800 over 23 days
  const marked = { ...cfg, fixedPaid: { periodStart: '2026-11-01', keys: ['rent', 'bills'] } }
  let r = computeToday(marked, [], d('2026-11-08'), undefined, { walletsTotal: 800 })
  assert.equal(r.daysLeft, 23); assert.equal(r.dueNow, 0)
  assert.equal(r.limitedBy, 'cash'); assert.ok(Math.abs(r.todayAllowance - 800 / 23) < 1e-9)
  assert.ok(r.planAllowance > 100)                                  // the plan alone would say ~163
  assert.equal(r.poolRemaining, 800); assert.equal(r.coach.key, 'cashLimited')
  assert.equal(r.coach.params.daily, 35); assert.equal(r.coach.params.cash, 800)

  // the same, but nothing marked: rent + bills (7000) are still due and 800 cannot cover them
  r = computeToday(cfg, [], d('2026-11-08'), undefined, { walletsTotal: 800 })
  assert.equal(r.dueNow, 7000); assert.equal(r.todayAllowance, 0); assert.equal(r.coach.key, 'cantCoverFixed')
  assert.equal(r.status, 'depleted')
  // marks from an older pay period do not count
  r = computeToday({ ...cfg, fixedPaid: { periodStart: '2026-10-01', keys: ['rent', 'bills'] } }, [], d('2026-11-08'), undefined, { walletsTotal: 800 })
  assert.equal(r.dueNow, 7000)

  // a logged rent payment counts as paid, partial payments leave the rest due
  r = computeToday(cfg, [tx('2026-11-02', 6000, 'Other', { essentialKey: 'rent' }), tx('2026-11-03', 400, 'Bills')], d('2026-11-08'), undefined, { walletsTotal: 2000 })
  assert.equal(r.dueNow, 600); assert.ok(Math.abs(r.todayAllowance - 1400 / 23) < 1e-9)
  assert.deepEqual(r.essentialsDue.map((e) => [e.key, e.due]), [['rent', 0], ['bills', 600]])

  // today's spending: the wallets already went down, the amount for today is from the start of the day
  r = computeToday(marked, [tx('2026-11-08', 20, 'Food')], d('2026-11-08'), undefined, { walletsTotal: 780 })
  assert.ok(Math.abs(r.todayAllowance - 800 / 23) < 1e-9); assert.ok(Math.abs(r.remainingToday - (800 / 23 - 20)) < 1e-9)
  assert.ok(Math.abs(r.tomorrowAllowance - 780 / 22) < 1e-9)
  // income received today is not part of the start-of-day money
  r = computeToday(marked, [{ type: 'income', amount: 500, createdAt: '2026-11-08T09:00:00' }], d('2026-11-08'), undefined, { walletsTotal: 1300 })
  assert.ok(Math.abs(r.todayAllowance - 800 / 23) < 1e-9)

  // more money than the plan: the plan still wins (savings stay protected)
  r = computeToday(marked, [], d('2026-11-08'), undefined, { walletsTotal: 50000 })
  assert.equal(r.limitedBy, 'plan'); assert.equal(r.todayAllowance, r.planAllowance); assert.ok(r.cash.gap < 0)
  // no wallets passed: plan-only behaviour, unchanged
  r = computeToday(marked, [], d('2026-11-08'))
  assert.equal(r.cash, null); assert.equal(r.limitedBy, 'plan')
})
