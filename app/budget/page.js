'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { subscribeToBudget } from '@/services/budgetService'
import { subscribeToWallets } from '@/services/walletService'
import { fetchTodayState } from '@/services/todayService'
import { computeToday } from '@/lib/planEngine'
import { walletsTotal } from '@/lib/walletTotal'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import FixedDueCard from '@/components/features/FixedDueCard'
import AddWalletModal from '@/components/features/AddWalletModal'
import styles from './page.module.css'

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

// `preloaded` ({ budget, wallets, transactions }) skips Firestore (used for UI tests).
export default function PlanPage({ preloaded } = {}) {
  const { user } = useUser()
  const { t, lang } = useTranslation()
  const currency = useCurrency()

  const [budget, setBudget] = useState(preloaded ? preloaded.budget : undefined) // undefined = loading
  const [wallets, setWallets] = useState(preloaded ? preloaded.wallets : null)
  const [transactions, setTransactions] = useState(preloaded ? preloaded.transactions : null)
  const [failed, setFailed] = useState(false)
  const [addingWallet, setAddingWallet] = useState(false)

  useEffect(() => {
    if (!user || preloaded) return
    let cancelled = false
    const unsubBudget = subscribeToBudget(user.uid, setBudget)
    const unsubWallets = subscribeToWallets(user.uid, setWallets)
    // Fixed-expense payments of this period come from the transactions.
    fetchTodayState(user.uid)
      .then((s) => { if (!cancelled) setTransactions(s.transactions) })
      .catch((err) => {
        console.error('[plan] load failed:', err)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (typeof unsubBudget === 'function') unsubBudget()
      if (typeof unsubWallets === 'function') unsubWallets()
    }
  }, [user, preloaded])

  const today = useMemo(() => {
    if (!budget?.planVersion || !transactions || wallets === null) return null
    return computeToday(budget, transactions, new Date(), undefined, { walletsTotal: walletsTotal(wallets) })
  }, [budget, transactions, wallets])

  const m = (n) => `${currency} ${fmt(n)}`
  const dateFmt = (d) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
  const realWins = (s) => s.limitedBy === 'cash' || (s.cash && s.cash.spendableNow <= 0)
  const loading = !failed && (budget === undefined || (budget?.planVersion && (!transactions || wallets === null)))

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('plan.title')}</h1>
          <p className={styles.subtitle}>{t('plan.subtitle')}</p>
        </div>
        {budget?.planVersion && <Link href="/onboarding" className={styles.editBtn}>{t('plan.edit')}</Link>}
      </header>

      {loading && <p className={styles.note}>{t('plan.loading')}</p>}
      {failed && <p className={styles.error} role="alert">{t('plan.error')}</p>}

      {!loading && budget !== undefined && !budget?.planVersion && (
        <section className={styles.card}>
          <p>{t('plan.noPlan')}</p>
          <Link href="/onboarding" className={styles.primary}>{t('plan.setup')}</Link>
        </section>
      )}

      {today?.hasPlan && (
        <>
          <section className={styles.card}>
            <div className={styles.periodRow}>
              <span>{t('plan.period')}: {dateFmt(today.period.start)} – {dateFmt(today.period.end)}</span>
              <strong>{fillText(t('plan.daysLeft'), { n: today.daysLeft })}</strong>
            </div>
            <h2 className={styles.h2}>{t('plan.breakdown')}</h2>
            <div className={styles.bar} aria-hidden="true">
              {today.plan.income > 0 && (
                <>
                  <span className={styles.barFixed} style={{ width: `${Math.min(100, (today.plan.essentials / today.plan.income) * 100)}%` }} />
                  <span className={styles.barSave} style={{ width: `${Math.min(100, (today.plan.savings / today.plan.income) * 100)}%` }} />
                  <span className={styles.barFree} style={{ width: `${Math.max(0, (today.plan.free / today.plan.income) * 100)}%` }} />
                </>
              )}
            </div>
            <dl className={styles.rows}>
              <div><dt>{t('plan.income')}</dt><dd dir="ltr">{m(today.plan.income)}</dd></div>
              <div><dt><i className={styles.dotFixed} />{t('plan.fixed')}</dt><dd dir="ltr">− {fmt(today.plan.essentials)}</dd></div>
              <div><dt><i className={styles.dotSave} />{fillText(t('plan.savings'), { pct: String(today.plan.savingsPct) })}</dt><dd dir="ltr">− {fmt(today.plan.savings)}</dd></div>
              <div className={styles.total}><dt><i className={styles.dotFree} />{t('plan.free')}</dt><dd dir="ltr">{m(today.freePool)}</dd></div>
            </dl>
          </section>

          <section className={styles.card} data-limited={today.limitedBy}>
            <h2 className={styles.h2}>{t('plan.realTitle')}</h2>
            {today.cash ? (
              <>
                <dl className={styles.rows}>
                  <div><dt>{t('plan.inWallets')}</dt><dd dir="ltr">{m(today.cash.walletsTotal)}</dd></div>
                  <div><dt>{t('plan.stillDue')}</dt><dd dir="ltr">− {fmt(today.cash.dueNow)}</dd></div>
                  <div className={styles.total}><dt>{t('plan.spendable')}</dt><dd dir="ltr">{m(Math.max(0, today.cash.spendableNow))}</dd></div>
                </dl>
                <div className={styles.compare}>
                  <div className={realWins(today) ? styles.active : ''}>
                    <strong>{m(today.cash.cashDaily)}</strong>
                    <span>{t('plan.perDayReal')}</span>
                  </div>
                  <div className={!realWins(today) ? styles.active : ''}>
                    <strong>{m(today.planAllowance)}</strong>
                    <span>{t('plan.perDayPlan')}</span>
                  </div>
                </div>
                <p className={styles.explain}>
                  {today.cash.spendableNow < 0
                    ? t('plan.shortFixed')
                    : today.todayAllowance <= 0
                      ? t('plan.noneLeft')
                      : today.limitedBy === 'cash' ? t('plan.usingReal') : t('plan.usingPlan')}
                </p>
              </>
            ) : (
              <>
                <p className={styles.explain}>{t('plan.noWallets')}</p>
                <button type="button" className={styles.primary} onClick={() => setAddingWallet(true)}>{t('plan.addWallet')}</button>
              </>
            )}
          </section>

          {user && <FixedDueCard uid={user.uid} budget={budget} today={today} variant="all" />}
        </>
      )}

      {addingWallet && user && <AddWalletModal uid={user.uid} onClose={() => setAddingWallet(false)} />}
    </div>
  )
}
