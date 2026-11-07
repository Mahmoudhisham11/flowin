// "Can I afford it?" - pure decision logic built on the Today state (see computeToday).
// Nothing here talks to Firebase or React.

const round = (n) => Math.round(n)

// A purchase that lowers the daily average by at most this much counts as small.
const SMALL_IMPACT_PCT = 8

/**
 * today: result of computeToday() with hasPlan === true
 * input: { price: number, kind: 'need' | 'want' }
 *
 * verdict: 'buy'     fits in the amount left for today
 *          'stretch' fits in the period, but lowers the daily amount for the rest of it
 *          'wait'    would leave too little, or is more than the free money left
 * reason:  'fitsToday' | 'stretch' | 'eatsPeriod' | 'tooBig' | 'noFreeMoney'
 * options: ordered suggestions, each { key, params }; the UI looks `key` up in the translations.
 */
export function evaluatePurchase(today, { price, kind = 'want' } = {}) {
  const amount = Number(price)
  if (!today?.hasPlan) return { verdict: 'noPlan' }
  if (!Number.isFinite(amount) || amount <= 0) return { verdict: 'invalid' }

  const { freePool, poolRemaining, remainingToday, daysLeft, baseDaily, plan, topLeaks } = today

  const avgBefore = poolRemaining > 0 ? poolRemaining / daysLeft : 0
  const afterPool = poolRemaining - amount
  const avgAfter = afterPool > 0 ? afterPool / daysLeft : 0
  const dropPct = avgBefore > 0 ? (1 - avgAfter / avgBefore) * 100 : 0
  const pctOfFree = freePool > 0 ? (amount / freePool) * 100 : 0
  const daysOfSpending = baseDaily > 0 ? amount / baseDaily : 0

  let verdict
  let reason
  if (freePool <= 0) {
    verdict = 'wait'
    reason = 'noFreeMoney'
  } else if (amount > poolRemaining) {
    verdict = 'wait'
    reason = 'tooBig'
  } else if (remainingToday > 0 && amount <= remainingToday) {
    verdict = 'buy'
    reason = 'fitsToday'
  } else if (dropPct <= SMALL_IMPACT_PCT) {
    // Slightly above today's amount, but it barely moves the daily average for the rest of the period.
    verdict = 'buy'
    reason = 'smallImpact'
  } else if (avgAfter >= baseDaily * 0.5) {
    verdict = 'stretch'
    reason = 'stretch'
  } else {
    verdict = 'wait'
    reason = 'eatsPeriod'
  }

  const options = []
  if (verdict === 'buy' || verdict === 'stretch') options.push({ key: 'buyNow', params: {} })

  if (verdict !== 'buy') {
    const available = plan?.savings || 0
    if (kind === 'need' && available > 0 && amount <= available) {
      options.push({ key: 'useSavings', params: { available: round(available) } })
    }

    // Save a modest slice (30%) of the normal daily amount until there is enough.
    const perDay = baseDaily * 0.3
    if (perDay > 0) {
      const days = Math.ceil(amount / perDay)
      if (days <= 180) {
        const ready = new Date(today.period.start.getTime())
        ready.setDate(ready.getDate() + today.dayIndex + days)
        options.push({ key: 'saveUp', params: { perDay: round(perDay), days }, readyDate: ready })
      }
    }

    // After payday the whole new period's free money is available again.
    if (freePool > 0 && amount <= freePool * 0.7) {
      options.push({ key: 'afterPayday', params: { days: daysLeft, pct: round(pctOfFree) } })
    }

    const leak = topLeaks?.[0]
    if (leak && leak.amount > 0) {
      options.push({ key: 'cutBack', params: { amount: round(leak.amount * 0.3) }, category: leak.category })
    }
  }

  return {
    verdict,
    reason,
    price: amount,
    kind,
    daysOfSpending,
    pctOfFree,
    dropPct,
    before: round(avgBefore),
    after: round(avgAfter),
    left: round(Math.max(0, remainingToday - amount)),
    pool: round(Math.max(0, poolRemaining)),
    daysLeft,
    options,
  }
}

/** Free-spending state after a hypothetical expense (used for the live preview while typing). */
export function previewAfterExpense(computeToday, config, transactions, expense, now = new Date()) {
  const hypothetical = {
    type: 'expense',
    amount: Number(expense.amount) || 0,
    category: expense.category,
    essentialKey: expense.essentialKey,
    createdAt: now.toISOString(),
  }
  return computeToday(config, [...(transactions || []), hypothetical], now)
}
