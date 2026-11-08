// Builds the data block the AI manager answers from. Pure: callers pass already-computed
// pieces (computeToday, buildReport, goalProgress...), so this is easy to test.

const n0 = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))
const clip = (s, len) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, len)

export function formatChatContext({
  firstName, currency = 'EGP', todayStr, essentials = [], today, week, wallets = [], goals = [], recent = [], tasks = null, totals30 = null,
}) {
  const m = (v) => `${currency} ${n0(v)}`
  const lines = []
  lines.push(`USER: ${clip(firstName, 30) || 'User'}`)
  lines.push(`TODAY: ${todayStr}. Currency: ${currency}.`)

  if (today?.hasPlan) {
    const p = today.period
    lines.push('')
    lines.push(`PLAN (current pay period ${p.startStr} to ${p.endStr}, ${today.totalDays} days, ${today.daysLeft} days left including today):`)
    lines.push(`- Income ${m(today.plan.income)}; fixed expenses ${m(today.plan.essentials)}; savings ${m(today.plan.savings)} (${today.plan.savingsPct}%); free spending money ${m(today.freePool)}.`)
    lines.push('')
    lines.push('FREE SPENDING STATUS (this is what matters most):')
    lines.push(`- Status: ${today.status}.`)
    lines.push(`- Safe to spend today: ${m(today.todayAllowance)}; spent today ${m(today.spentToday)}; left today ${m(today.remainingToday)}${today.remainingToday < 0 ? ' (OVER the limit)' : ''}.`)
    lines.push(`- Free money left this pay period: ${m(Math.max(0, today.poolRemaining))} of ${m(today.freePool)} (${Math.round(today.usedPct)}% used, ${Math.round(today.elapsedPct)}% of the period passed).`)
    lines.push(`- Normal daily amount: ${m(today.baseDaily)}. If nothing more is spent today, tomorrow's amount is ${m(today.tomorrowAllowance)}.`)
    if (today.topLeaks?.length) {
      lines.push(`- Biggest free-spending categories this period: ${today.topLeaks.map((c) => `${c.category} ${m(c.amount)}`).join(', ')}.`)
    }

    if (essentials.length) {
      lines.push('')
      lines.push('FIXED EXPENSES (planned, paid so far this period):')
      essentials.forEach((e, i) => lines.push(`- ${clip(e.name, 40)}: ${m(e.amount)}, paid ${m(today.essentialSpent?.[i] || 0)}`))
    }
  } else {
    lines.push('')
    lines.push('The user has not finished setting up a spending plan yet. Encourage them to complete the setup (income, fixed expenses, savings) so you can give daily guidance. Answer from the basic data below.')
  }

  if (week?.hasPlan) {
    lines.push('')
    lines.push('LAST 7 DAYS:')
    lines.push(`- Free spending ${m(week.cur.free)} vs planned ${m(week.allowance)} (rating: ${week.rating}).`)
    if (week.prev.free > 0) {
      const pct = ((week.cur.free - week.prev.free) / week.prev.free) * 100
      lines.push(`- ${pct >= 0 ? 'Up' : 'Down'} ${Math.abs(Math.round(pct))}% compared with the 7 days before (${m(week.prev.free)}).`)
    }
    if (week.topCategories?.length) lines.push(`- Top categories: ${week.topCategories.map((c) => `${c.category} ${m(c.amount)}`).join(', ')}.`)
    if (week.weakSpots?.length) lines.push(`- Habits the user wants to control: ${week.weakSpots.map((c) => `${c.category} ${m(c.amount)}`).join(', ')}.`)
    lines.push(`- Days over the daily amount: ${week.overDays} of ${week.cur.days}.`)
  }

  if (goals.length) {
    lines.push('')
    lines.push('SAVINGS GOALS:')
    goals.forEach(({ name, p }) => {
      const parts = [`${clip(name, 40)}: ${m(p.saved)} of ${m(p.target)} (${Math.round(p.pct)}%), ${p.status}`]
      if (p.perPeriod) parts.push(`needs ${m(p.perPeriod)} per pay period`)
      if (p.daysLeft !== undefined && p.daysLeft >= 0) parts.push(`${p.daysLeft} days left`)
      lines.push(`- ${parts.join('; ')}`)
    })
  }

  if (wallets.length) {
    const total = wallets.reduce((s, w) => s + (Number(w.balance) || 0), 0)
    lines.push('')
    lines.push(`WALLETS (total ${m(total)}):`)
    wallets.slice(0, 12).forEach((w) => lines.push(`- ${clip(w.name, 30)} (${w.type || 'wallet'}): ${m(w.balance)}`))
  }

  if (totals30) {
    lines.push('')
    lines.push(`LAST 30 DAYS: spent ${m(totals30.spent)}, income ${m(totals30.income)}.`)
    const cats = Object.entries(totals30.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 5)
    if (cats.length) lines.push(`- Top categories: ${cats.map(([c, v]) => `${c} ${m(v)}`).join(', ')}.`)
  }

  if (recent.length) {
    lines.push('')
    lines.push('RECENT TRANSACTIONS (newest first):')
    recent.slice(0, 12).forEach((t) => {
      const note = clip(t.reason || t.merchant || '', 40)
      lines.push(`- ${t.date} ${t.type} ${t.category || ''} ${m(t.amount)}${note ? ` (${note})` : ''}`)
    })
  }

  if (tasks) {
    lines.push('')
    lines.push(`TASKS: ${tasks.todayDone}/${tasks.todayTotal} done today, ${tasks.overdue} overdue.`)
    tasks.todayItems?.slice(0, 8).forEach((t) => lines.push(`- ${t.completed ? '[x]' : '[ ]'} ${clip(t.title, 60)}`))
  }

  return lines.join('\n')
}
