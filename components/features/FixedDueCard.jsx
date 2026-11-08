'use client'

import { useState } from 'react'
import { saveBudget } from '@/services/budgetService'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import styles from './FixedDueCard.module.css'

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

/**
 * Fixed expenses of the current pay period with a "paid" toggle.
 * variant 'due' (home): only what is still to pay, hidden when nothing is due.
 * variant 'all' (plan page): every fixed expense with its state.
 * The marks are stored in budget.fixedPaid = { periodStart, keys } and reset every pay period.
 */
export default function FixedDueCard({ uid, budget, today, variant = 'due' }) {
  const { t } = useTranslation()
  const currency = useCurrency()
  const [busyKey, setBusyKey] = useState(null)

  if (!today?.hasPlan) return null
  const items = variant === 'due' ? today.essentialsDue.filter((e) => e.due > 0) : today.essentialsDue.filter((e) => e.amount > 0)
  if (variant === 'due' && items.length === 0) return null

  const periodStart = today.period.startStr
  const marked = budget?.fixedPaid?.periodStart === periodStart ? budget.fixedPaid.keys || [] : []

  const toggle = async (key, paid) => {
    setBusyKey(key)
    try {
      const keys = paid ? [...new Set([...marked, key])] : marked.filter((k) => k !== key)
      await saveBudget(uid, { fixedPaid: { periodStart, keys } })
    } catch (err) {
      console.error('[fixed] could not save mark:', err)
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>{variant === 'due' ? t('plan.dueCardTitle') : t('plan.fixedTitle')}</h2>
      <p className={styles.hint}>{variant === 'due' ? t('plan.dueCardHint') : t('plan.fixedHint')}</p>
      {items.length === 0 && <p className={styles.hint}>{t('plan.noFixed')}</p>}
      <ul className={styles.list}>
        {items.map((e) => {
          const logged = e.spent >= e.amount && e.amount > 0
          return (
            <li key={e.key} className={styles.row} data-state={logged || e.paid ? 'paid' : 'due'}>
              <div className={styles.info}>
                <span className={styles.name}>{e.name}</span>
                <span className={styles.amount}>
                  {logged || e.paid ? `${currency} ${fmt(e.amount)}` : fillText(t('plan.due'), { amount: `${currency} ${fmt(e.due)}` })}
                </span>
              </div>
              {logged ? (
                <span className={styles.badge}>{t('plan.paidLogged')}</span>
              ) : e.paid ? (
                <button type="button" className={styles.undo} disabled={busyKey === e.key} onClick={() => toggle(e.key, false)}>
                  <span className={styles.badge}>{t('plan.paid')}</span>
                  <span className={styles.undoText}>{t('plan.unmark')}</span>
                </button>
              ) : (
                <button type="button" className={styles.mark} disabled={busyKey === e.key} onClick={() => toggle(e.key, true)}>
                  {t('plan.markPaid')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
