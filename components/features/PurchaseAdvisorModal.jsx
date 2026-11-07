'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fetchTodayState } from '@/services/todayService'
import { evaluatePurchase } from '@/lib/purchaseAdvisor'
import { getCategory } from '@/lib/categories'
import { fillText } from '@/lib/fillText'
import { toNum } from '@/lib/parseAmount'
import { toDateStr } from '@/lib/planEngine'
import { GoalFormModal } from './GoalModals'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import useSmoothClose from '@/hooks/useSmoothClose'
import base from './AddExpenseModal.module.css'
import styles from './PurchaseAdvisorModal.module.css'

// `preloaded` ({ today }) skips the fetch (used by tests and when the caller already has the state).
export default function PurchaseAdvisorModal({ uid, onClose, onBuy, preloaded }) {
  const { t, lang } = useTranslation()
  const currency = useCurrency()
  const { isClosing, handleClose } = useSmoothClose(onClose)

  const [today, setToday] = useState(preloaded?.today || null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [item, setItem] = useState('')
  const [price, setPrice] = useState('')
  const [kind, setKind] = useState('want')
  const [result, setResult] = useState(null)
  const [goalForm, setGoalForm] = useState(null)
  const [goalSaved, setGoalSaved] = useState(false)

  useEffect(() => {
    if (preloaded?.today) return
    let cancelled = false
    fetchTodayState(uid)
      .then((s) => { if (!cancelled) setToday(s.today) })
      .catch((err) => {
        console.error('[purchase] could not load plan:', err)
        if (!cancelled) setLoadFailed(true)
      })
    return () => { cancelled = true }
  }, [uid, preloaded])

  const amount = toNum(price)
  const pctLabel = (n) => String(Math.round(n))
  const dateLabel = (d) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })

  const handleCheck = (e) => {
    e.preventDefault()
    if (!today || amount <= 0) return
    setResult(evaluatePurchase(today, { price: amount, kind }))
  }

  const reset = () => {
    setResult(null)
    setItem('')
    setPrice('')
  }

  const view = useMemo(() => {
    if (!result || !result.verdict || result.verdict === 'invalid' || result.verdict === 'noPlan') return null
    const p = {
      left: `${currency} ${fillText('{v}', { v: result.left })}`,
      before: `${currency} ${fillText('{v}', { v: result.before })}`,
      after: `${currency} ${fillText('{v}', { v: result.after })}`,
      pool: `${currency} ${fillText('{v}', { v: result.pool })}`,
      daysLeft: result.daysLeft,
    }
    return {
      headline: fillText(t(`purchase.headline.${result.reason}`), p),
      impact: [
        result.daysOfSpending > 0 && fillText(t('purchase.impactDays'), { days: result.daysOfSpending.toFixed(1) }),
        result.pctOfFree > 0 && fillText(t('purchase.impactPct'), { pct: pctLabel(result.pctOfFree) }),
      ].filter(Boolean),
      options: result.options
        .filter((o) => o.key !== 'buyNow')
        .map((o) => {
          const params = { ...o.params }
          if (o.key === 'useSavings') params.available = `${currency} ${fillText('{v}', { v: params.available })}`
          if (o.key === 'saveUp') { params.perDay = `${currency} ${fillText('{v}', { v: params.perDay })}`; params.date = dateLabel(o.readyDate) }
          if (o.key === 'cutBack') {
            params.amount = `${currency} ${fillText('{v}', { v: params.amount })}`
            const c = getCategory(o.category)
            params.category = lang === 'ar' ? c.labelAr : c.labelEn
          }
          if (o.key === 'afterPayday') params.pct = pctLabel(params.pct)
          return { key: o.key, text: fillText(t(`purchase.options.${o.key}`), params) }
        }),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, lang, currency])

  const canBuy = result && (result.verdict === 'buy' || result.verdict === 'stretch')
  const saveUpOption = result?.options?.find((o) => o.key === 'saveUp')
  const canSaveAsGoal = result && result.verdict !== 'buy' && result.verdict !== 'invalid'

  return (
    <div className={`${base.overlay} ${isClosing ? base.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${base.modal} ${isClosing ? base.modalClosing : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('purchase.title')}>
        <div className={base.header}>
          <h2 className={base.title}>{t('purchase.title')}</h2>
          <p className={base.subtitle}>{t('purchase.subtitle')}</p>
        </div>

        {!today && !loadFailed && <p className={styles.note}>{t('purchase.loading')}</p>}
        {loadFailed && <p className={base.error}>{t('onboarding.saveError')}</p>}

        {today && !today.hasPlan && (
          <div className={styles.noPlan}>
            <p>{t('purchase.noPlan')}</p>
            <Link href="/onboarding" className={styles.cta} onClick={handleClose}>{t('purchase.noPlanCta')}</Link>
          </div>
        )}

        {today?.hasPlan && !result && (
          <form className={base.form} onSubmit={handleCheck}>
            <div className={base.field}>
              <label className={base.label} htmlFor="pa-item">{t('purchase.itemLabel')}</label>
              <input id="pa-item" className={base.input} type="text" placeholder={t('purchase.itemPlaceholder')} value={item} onChange={(e) => setItem(e.target.value)} />
            </div>

            <div className={base.field}>
              <label className={base.label} htmlFor="pa-price">{t('purchase.priceLabel')}</label>
              <div className={base.amountWrap}>
                <span className={base.amountCurrency}>{currency}</span>
                <input id="pa-price" className={base.amountInput} type="text" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />
              </div>
            </div>

            <div className={base.field}>
              <span className={base.label}>{t('purchase.kindLabel')}</span>
              <div className={styles.kinds}>
                {['need', 'want'].map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} className={`${styles.kind} ${kind === k ? styles.kindOn : ''}`} onClick={() => setKind(k)}>
                    {t(`purchase.${k}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className={base.actions}>
              <button type="submit" className={base.saveBtn} disabled={amount <= 0}>{t('purchase.check')}</button>
              <button type="button" className={base.cancelBtn} onClick={handleClose}>{t('cancel')}</button>
            </div>
          </form>
        )}

        {goalSaved && (
          <div className={styles.noPlan}>
            <p>{t('goals.goalCreated')}</p>
            <Link href="/goals" className={styles.cta} onClick={handleClose}>{t('goals.seeGoals')}</Link>
          </div>
        )}

        {!goalSaved && today?.hasPlan && result && view && (
          <div className={styles.result} data-verdict={result.verdict}>
            <div className={styles.itemLine}>
              <strong>{item.trim() || t('purchase.title')}</strong>
              <span>{currency} {fillText('{v}', { v: result.price })}</span>
            </div>
            <div className={styles.verdict}>{t(`purchase.verdict.${result.verdict}`)}</div>
            <p className={styles.headline}>{view.headline}</p>

            {view.impact.length > 0 && (
              <ul className={styles.impact}>
                {view.impact.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}

            {view.options.length > 0 && (
              <div className={styles.options}>
                <h3>{t('purchase.optionsTitle')}</h3>
                <ul>
                  {view.options.map((o) => <li key={o.key}>{o.text}</li>)}
                </ul>
              </div>
            )}

            <div className={base.actions}>
              {canBuy && (
                <button type="button" className={base.saveBtn} onClick={() => onBuy?.({ amount: result.price, reason: item.trim() })}>
                  {t('purchase.recordIt')}
                </button>
              )}
              {canSaveAsGoal && (
                <button type="button" className={base.cancelBtn} onClick={() => setGoalForm({ name: item.trim(), targetAmount: result.price, targetDate: saveUpOption ? toDateStr(saveUpOption.readyDate) : '', kind: 'purchase' })}>
                  {t('goals.saveAsGoal')}
                </button>
              )}
              <button type="button" className={base.cancelBtn} onClick={reset}>{t('purchase.another')}</button>
              <button type="button" className={base.cancelBtn} onClick={handleClose}>{t('purchase.notNow')}</button>
            </div>
          </div>
        )}
      </div>
      {goalForm && (
        <div onClick={(e) => e.stopPropagation()}>
          <GoalFormModal uid={uid} initial={goalForm} onClose={() => setGoalForm(null)} onSaved={() => setGoalSaved(true)} />
        </div>
      )}
    </div>
  )
}
