'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { subscribeToGoals, createGoal, deleteGoal } from '@/services/goalsService'
import { subscribeToBudget } from '@/services/budgetService'
import { getPeriod, computePlan } from '@/lib/planEngine'
import { goalProgress, goalsSummary, emergencyFundTarget } from '@/lib/goalEngine'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import { GoalFormModal, ContributeModal } from '@/components/features/GoalModals'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './page.module.css'

const money = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

// `preloaded` ({ goals, budget }) skips the Firestore subscriptions (used for UI tests).
export default function GoalsPage({ preloaded } = {}) {
  const { user } = useUser()
  const { t, lang } = useTranslation()
  const currency = useCurrency()

  const [goals, setGoals] = useState(preloaded?.goals ?? null)
  const [budget, setBudget] = useState(preloaded?.budget ?? null)
  const [form, setForm] = useState(null) // { goal? }
  const [contribute, setContribute] = useState(null) // { goal, mode, suggested }
  const [removing, setRemoving] = useState(null)
  const [busy, setBusy] = useState(false)
  const [nowTick] = useState(() => Date.now())

  useEffect(() => {
    if (!user || preloaded) return
    const unsubGoals = subscribeToGoals(user.uid, setGoals)
    const unsubBudget = subscribeToBudget(user.uid, setBudget)
    return () => {
      unsubGoals()
      if (typeof unsubBudget === 'function') unsubBudget()
    }
  }, [user, preloaded])

  const now = useMemo(() => new Date(nowTick), [nowTick])
  const hasPlan = Boolean(budget?.planVersion)

  const { periodDays, savingsPerPeriod, periodKey } = useMemo(() => {
    if (!hasPlan) return { periodDays: 30, savingsPerPeriod: 0, periodKey: 'perMonth' }
    const period = getPeriod(budget, now)
    const essentials = (budget.essentialCategories || []).filter((e) => e && e.name)
    const sources = budget.incomeSources?.length ? budget.incomeSources : [{ amount: budget.monthlyIncome }]
    const plan = computePlan({ incomeSources: sources, essentials, savingsPct: budget.savingsPct }, period)
    return {
      periodDays: period.totalDays,
      savingsPerPeriod: plan.savings,
      periodKey: { monthly: 'perMonth', biweekly: 'perBiweekly', weekly: 'perWeek' }[budget.payCycle] || 'perMonth',
    }
  }, [budget, hasPlan, now])

  const items = useMemo(
    () => (goals || []).map((g) => ({ goal: g, p: goalProgress(g, now, { periodDays, savingsPerPeriod }) })),
    [goals, now, periodDays, savingsPerPeriod]
  )
  const active = items.filter((i) => !i.p.done)
  const finished = items.filter((i) => i.p.done)
  const summary = goalsSummary(active.map((i) => i.p), savingsPerPeriod)

  const period = t(`goals.${periodKey}`)
  const emergencyAmount = hasPlan ? emergencyFundTarget(budget, 3, now) : 0
  const showEmergency = goals && !goals.some((g) => g.kind === 'emergency') && emergencyAmount > 0

  const dateLabel = (d) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const hintFor = ({ p }) => {
    const m = (n) => `${currency} ${money(n)}`
    if (p.done) return t('goals.hint.done')
    if (p.status === 'overdue') return fillText(t('goals.hint.overdue'), { remaining: m(p.remaining) })
    if (p.targetDate) {
      const key = p.status === 'behind' ? 'behind' : 'onTrack'
      return fillText(t(`goals.hint.${key}`), { amount: m(p.perPeriod), period, date: dateLabel(p.targetDate), behind: m(p.behindBy || 0) })
    }
    if (p.etaDate) return fillText(t('goals.hint.eta'), { date: dateLabel(p.etaDate) })
    return fillText(t('goals.hint.noDate'), { period })
  }

  const createEmergency = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      await createGoal(user.uid, { name: t('goals.emergencyName'), emoji: '🛟', kind: 'emergency', targetAmount: emergencyAmount, targetDate: null })
    } catch (err) {
      console.error('[goals] emergency fund failed:', err)
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    const g = removing
    setRemoving(null)
    if (!g || !user) return
    try { await deleteGoal(user.uid, g.id) } catch (err) { console.error('[goals] delete failed:', err) }
  }

  const renderCard = (item, { finishedCard = false } = {}) => {
    const { goal, p } = item
    return (
      <article key={goal.id} className={styles.card} data-status={p.status}>
        <div className={styles.cardHead}>
          <span className={styles.emoji} aria-hidden="true">{goal.emoji || '🎯'}</span>
          <div className={styles.cardTitle}>
            <h3>{goal.name}</h3>
            <span className={styles.badge}>{t(`goals.status.${p.status}`)}</span>
          </div>
        </div>

        <div className={styles.amounts}>
          <strong>{currency} {money(p.saved)}</strong>
          <span>{t('goals.of')} {currency} {money(p.target)} · {Math.round(p.pct)}%</span>
        </div>
        <div className={styles.track} role="progressbar" aria-valuenow={Math.round(p.pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.fill} style={{ width: `${p.pct}%` }} />
        </div>
        <p className={styles.hint}>{hintFor(item)}</p>

        <div className={styles.actions}>
          {!finishedCard && (
            <button type="button" className={styles.primary} onClick={() => setContribute({ goal, mode: 'add', suggested: p.perPeriod || 0 })}>
              {t('goals.addMoney')}
            </button>
          )}
          {p.saved > 0 && (
            <button type="button" className={styles.ghost} onClick={() => setContribute({ goal, mode: 'withdraw' })}>{t('goals.withdraw')}</button>
          )}
          <button type="button" className={styles.ghost} onClick={() => setForm({ goal })}>{t('goals.edit')}</button>
          <button type="button" className={styles.danger} onClick={() => setRemoving(goal)}>{t('goals.delete')}</button>
        </div>
      </article>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('goals.title')}</h1>
          <p className={styles.subtitle}>{t('goals.subtitle')}</p>
        </div>
        <button type="button" className={styles.newBtn} onClick={() => setForm({})}>+ {t('goals.newGoal')}</button>
      </header>

      {goals === null && <p className={styles.note}>{t('goals.loading')}</p>}

      {hasPlan && active.length > 0 && (
        <section className={`${styles.summary} ${summary.overCommitted ? styles.summaryWarn : ''}`}>
          <p>{fillText(t('goals.planSavings'), { amount: `${currency} ${money(summary.savingsPerPeriod)}`, period })}</p>
          <p>{fillText(t('goals.needs'), { amount: `${currency} ${money(summary.requiredPerPeriod)}`, period })}</p>
          <p className={styles.summaryVerdict}>
            {summary.overCommitted
              ? fillText(t('goals.overCommitted'), { amount: `${currency} ${money(summary.shortfall)}` })
              : t('goals.fine')}
          </p>
        </section>
      )}

      {showEmergency && (
        <section className={styles.emergency}>
          <div>
            <h3>🛟 {t('goals.emergencyTitle')}</h3>
            <p>{fillText(t('goals.emergencyDesc'), { amount: `${currency} ${money(emergencyAmount)}` })}</p>
          </div>
          <button type="button" className={styles.primary} onClick={createEmergency} disabled={busy}>{t('goals.emergencyCta')}</button>
        </section>
      )}

      {goals && goals.length === 0 && !showEmergency && <p className={styles.empty}>{t('goals.empty')}</p>}

      <div className={styles.list}>{active.map((i) => renderCard(i))}</div>

      {finished.length > 0 && (
        <>
          <h2 className={styles.sectionTitle}>{t('goals.doneTitle')}</h2>
          <div className={styles.list}>{finished.map((i) => renderCard(i, { finishedCard: true }))}</div>
        </>
      )}

      <p className={styles.footnote}>{t('goals.virtualNote')}</p>

      {form && user && <GoalFormModal uid={user.uid} goal={form.goal} onClose={() => setForm(null)} />}
      {contribute && user && (
        <ContributeModal uid={user.uid} goal={contribute.goal} mode={contribute.mode} suggested={contribute.suggested} onClose={() => setContribute(null)} />
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        title={t('goals.deleteTitle')}
        message={t('goals.deleteMsg')}
        confirmLabel={t('goals.delete')}
        cancelLabel={t('goals.cancel')}
        onConfirm={confirmDelete}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
