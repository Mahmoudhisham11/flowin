import test from 'node:test'
import assert from 'node:assert/strict'
import { computeToday } from '../lib/planEngine.js'
import { evaluatePurchase, previewAfterExpense } from '../lib/purchaseAdvisor.js'
import { guessCategory, guessEssentialKey } from '../lib/categoryGuess.js'

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd) }
const tx = (day, amount, category = 'Food') => ({ type: 'expense', amount, category, createdAt: `${day}T12:00:00` })
const cfg = {
  planVersion: 1, payCycle: 'monthly', payDay: 1, savingsPct: 15, incomeSources: [{ amount: 14000 }],
  essentialCategories: [{ name: 'Rent', amount: 7000, presetId: 'rent' }],
} // free money 4900 over 30 days => 163/day

test('purchase verdicts follow the free money left', () => {
  const day1 = computeToday(cfg, [], d('2026-11-01'))

  let r = evaluatePurchase(day1, { price: 100 })
  assert.equal(r.verdict, 'buy'); assert.equal(r.reason, 'fitsToday'); assert.equal(r.left, 63)
  assert.deepEqual(r.options.map((o) => o.key), ['buyNow'])

  r = evaluatePurchase(day1, { price: 200 })            // a bit above today's 163, but only a ~4% drop
  assert.equal(r.verdict, 'buy'); assert.equal(r.reason, 'smallImpact'); assert.ok(r.dropPct < 8)

  r = evaluatePurchase(day1, { price: 1000 })           // more than today, still fine for the period
  assert.equal(r.verdict, 'stretch'); assert.equal(r.before, 163); assert.equal(r.after, 130)
  assert.ok(Math.abs(r.dropPct - 20.4) < 0.1); assert.equal(r.options[0].key, 'buyNow')

  r = evaluatePurchase(day1, { price: 4000 })           // leaves 30/day (< half of normal)
  assert.equal(r.verdict, 'wait'); assert.equal(r.reason, 'eatsPeriod')
  assert.ok(!r.options.some((o) => o.key === 'buyNow'))

  r = evaluatePurchase(day1, { price: 6000 })
  assert.equal(r.verdict, 'wait'); assert.equal(r.reason, 'tooBig'); assert.equal(r.pool, 4900)

  assert.equal(evaluatePurchase(day1, { price: 0 }).verdict, 'invalid')
  assert.equal(evaluatePurchase(day1, { price: 'abc' }).verdict, 'invalid')
  assert.equal(evaluatePurchase({ hasPlan: false }, { price: 10 }).verdict, 'noPlan')
})

test('options: save up, payday, savings for needs, cutting back', () => {
  const day1 = computeToday(cfg, [], d('2026-11-01'))
  let r = evaluatePurchase(day1, { price: 4000 })
  const save = r.options.find((o) => o.key === 'saveUp')
  assert.equal(save.params.perDay, 49); assert.equal(save.params.days, Math.ceil(4000 / (4900 / 30 * 0.3)))
  assert.ok(save.readyDate instanceof Date)
  assert.equal(r.options.some((o) => o.key === 'afterPayday'), false)   // 4000 is 82% of the free money: too much for one period

  r = evaluatePurchase(day1, { price: 3000 })           // 61% of free money => offered
  const payday = r.options.find((o) => o.key === 'afterPayday')
  assert.equal(payday.params.pct, 61); assert.equal(payday.params.days, 30)

  // needs can use this period's savings (2100) instead of debt; wants cannot
  const spent = computeToday(cfg, [tx('2026-11-02', 4500)], d('2026-11-03'))
  r = evaluatePurchase(spent, { price: 800, kind: 'need' })
  assert.equal(r.reason, 'tooBig'); assert.equal(r.options[0].key, 'useSavings'); assert.equal(r.options[0].params.available, 2100)
  r = evaluatePurchase(spent, { price: 800, kind: 'want' })
  assert.ok(!r.options.some((o) => o.key === 'useSavings'))
  const cut = r.options.find((o) => o.key === 'cutBack')
  assert.equal(cut.category, 'Food'); assert.equal(cut.params.amount, 1350)

  // too big to save for within 180 days -> no saveUp
  assert.ok(!evaluatePurchase(day1, { price: 100000 }).options.some((o) => o.key === 'saveUp'))

  // no free money at all
  const none = computeToday({ ...cfg, essentialCategories: [{ name: 'X', amount: 13000 }] }, [], d('2026-11-05'))
  r = evaluatePurchase(none, { price: 50 })
  assert.equal(r.verdict, 'wait'); assert.equal(r.reason, 'noFreeMoney')
})

test('live preview of an expense before it is saved', () => {
  const now = d('2026-11-05')
  const before = computeToday(cfg, [{ ...tx('2026-11-05', 40) }], now)
  const after = previewAfterExpense(computeToday, cfg, [tx('2026-11-05', 40)], { amount: 100, category: 'Food' }, new Date(2026, 10, 5, 15))
  assert.equal(Math.round(before.remainingToday - after.remainingToday), 100)
  // a hypothetical rent payment tagged as a fixed expense does not touch free money
  const rent = previewAfterExpense(computeToday, cfg, [], { amount: 7000, category: 'Bills', essentialKey: 'rent' }, new Date(2026, 10, 5, 15))
  assert.equal(rent.spentToday, 0)
  const bad = previewAfterExpense(computeToday, cfg, [], { amount: 'x' }, new Date(2026, 10, 5, 15))
  assert.equal(bad.spentToday, 0)
})

test('category guesses from typed text', () => {
  const cases = [
    ['اوبر للشغل', 'Transport'], ['uber home', 'Transport'], ['بنزين', 'Transport'], ['بالمترو', 'Transport'],
    ['غدا مع صحابي', 'Food'], ['دليفري', 'Food'], ['coffee', 'Food'], ['قهوة', 'Food'], ['restaurants', 'Food'],
    ['علبة سجاير', 'Smoking'], ['فاتورة الكهرباء', 'Bills'], ['شحن رصيد', 'Bills'], ['internet', 'Bills'],
    ['صيدلية', 'Health'], ['دوا', 'Health'], ['سينما', 'Entertainment'], ['Netflix', 'Entertainment'],
    ['هدوم', 'Shopping'], ['amazon order', 'Shopping'],
  ]
  for (const [text, cat] of cases) assert.equal(guessCategory(text), cat, text)
  for (const text of ['', '   ', 'نتيجة', 'business', 'busy', 'xyz', 'كنتاكي']) assert.equal(guessCategory(text), null, text)
  assert.equal(guessCategory('', 'اوبر'), 'Transport')   // merchant empty, reason set
  assert.equal(guessCategory(undefined, null, 'غدا'), 'Food')

  const ess = [{ name: 'Rent', presetId: 'rent' }, { name: 'Installments', presetId: 'installments' }]
  assert.equal(guessEssentialKey(ess, 'ايجار الشقة'), 'rent')
  assert.equal(guessEssentialKey(ess, 'قسط العربية'), 'installments')
  assert.equal(guessEssentialKey(ess, 'غدا'), null)
  assert.equal(guessEssentialKey([{ name: 'Transport', presetId: 'transport' }], 'ايجار'), null)  // not in the user's plan
})
