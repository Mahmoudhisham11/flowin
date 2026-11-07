import test from 'node:test'
import assert from 'node:assert/strict'
import { getPeriod, computePlan, recommendSavingsPct } from '../lib/planEngine.js'

test('pay periods and plan allocation', () => {
  const d = (s) => { const [y,m,dd]=s.split('-').map(Number); return new Date(y,m-1,dd) }
  const p = (plan, day) => { const r = getPeriod(plan, d(day)); return [r.startStr, r.endStr, r.totalDays, r.daysLeft] }

  // monthly, payday 25
  assert.deepEqual(p({payCycle:'monthly',payDay:25},'2026-11-07'), ['2026-10-25','2026-11-25',31,18])
  assert.deepEqual(p({payCycle:'monthly',payDay:25},'2026-11-25'), ['2026-11-25','2026-12-25',30,30]) // payday itself starts a new period
  assert.deepEqual(p({payCycle:'monthly',payDay:25},'2026-11-24'), ['2026-10-25','2026-11-25',31,1])  // last day
  // payday 1 across year end
  assert.deepEqual(p({payCycle:'monthly',payDay:1},'2026-12-31'), ['2026-12-01','2027-01-01',31,1])
  assert.deepEqual(p({payCycle:'monthly',payDay:1},'2027-01-01'), ['2027-01-01','2027-02-01',31,31])
  // payday 31 clamps to short months
  assert.deepEqual(p({payCycle:'monthly',payDay:31},'2027-02-15'), ['2027-01-31','2027-02-28',28,13])
  assert.deepEqual(p({payCycle:'monthly',payDay:31},'2027-03-05'), ['2027-02-28','2027-03-31',31,26])
  // leap year
  assert.deepEqual(p({payCycle:'monthly',payDay:30},'2028-02-29'), ['2028-02-29','2028-03-30',30,30])
  // January looks back to December of the previous year
  assert.deepEqual(p({payCycle:'monthly',payDay:20},'2027-01-05'), ['2026-12-20','2027-01-20',31,15])
  // weekly / biweekly anchored on last pay date
  assert.deepEqual(p({payCycle:'weekly',lastPayDate:'2026-11-05'},'2026-11-07'), ['2026-11-05','2026-11-12',7,5])
  assert.deepEqual(p({payCycle:'weekly',lastPayDate:'2026-11-05'},'2026-11-12'), ['2026-11-12','2026-11-19',7,7])
  assert.deepEqual(p({payCycle:'biweekly',lastPayDate:'2026-10-01'},'2026-11-07'), ['2026-10-29','2026-11-12',14,5])
  const fut = getPeriod({payCycle:'weekly',lastPayDate:'2026-11-20'}, d('2026-11-07'))
  assert.ok(fut.daysLeft >= 1 && fut.daysLeft <= 7 && fut.totalDays === 7)
  // DST-crossing (Europe/US dates) keeps whole days
  assert.equal(getPeriod({payCycle:'monthly',payDay:1}, d('2026-03-29')).totalDays, 31)
  // bad input falls back safely
  assert.equal(getPeriod({}, d('2026-11-07')).totalDays > 0, true)
  assert.equal(getPeriod({payCycle:'monthly',payDay:99}, d('2026-11-07')).startStr, '2026-10-31')

  // allocation
  const period = getPeriod({payCycle:'monthly',payDay:25}, d('2026-11-30')) // 30 days
  let r = computePlan({ incomeSources:[{amount:14000}], essentials:[{amount:7000}], savingsPct:15 }, period)
  assert.equal(r.income,14000); assert.equal(r.essentials,7000); assert.equal(r.savings,2100)
  assert.equal(r.free,4900); assert.equal(Math.round(r.dailyAllowance), 163); assert.deepEqual(r.warnings,[])
  r = computePlan({ incomeSources:[{amount:5000},{amount:2000},{amount:-5},{amount:'x'}], essentials:[{amount:3000}], savingsPct:10 }, period)
  assert.equal(r.income,7000); assert.equal(r.savings,700)
  r = computePlan({ incomeSources:[{amount:5000}], essentials:[{amount:6000}], savingsPct:10 }, period)
  assert.deepEqual(r.warnings,['essentialsExceedIncome']); assert.equal(r.freeSpend,0); assert.equal(r.dailyAllowance,0)
  r = computePlan({ incomeSources:[{amount:5000}], essentials:[{amount:4000}], savingsPct:30 }, period)
  assert.deepEqual(r.warnings,['savingsTooHigh']); assert.ok(r.free<0)
  r = computePlan({ incomeSources:[{amount:5000}], essentials:[{amount:4300}], savingsPct:5 }, period)
  assert.deepEqual(r.warnings,['tight']); assert.equal(r.ok,true)
  r = computePlan({ incomeSources:[], essentials:[], savingsPct:10 }, period)
  assert.deepEqual(r.warnings,['noIncome'])
  assert.equal(computePlan({incomeSources:[{amount:100}],essentials:[],savingsPct:500},period).savingsPct,100)
  assert.equal(recommendSavingsPct(14000,7000),15); assert.equal(recommendSavingsPct(14000,10500),10)
  assert.equal(recommendSavingsPct(14000,12500),5); assert.equal(recommendSavingsPct(14000,15000),0); assert.equal(recommendSavingsPct(0,0),0)

})
