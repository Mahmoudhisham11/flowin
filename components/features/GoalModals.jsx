'use client'

import { useState } from 'react'
import { createGoal, updateGoal, addContribution } from '@/services/goalsService'
import { normalizeGoalInput } from '@/lib/goalEngine'
import { toNum } from '@/lib/parseAmount'
import { toDateStr } from '@/lib/planEngine'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import useSmoothClose from '@/hooks/useSmoothClose'
import base from './AddExpenseModal.module.css'
import styles from './GoalModals.module.css'

const EMOJIS = ['🎯', '🛟', '💻', '📱', '✈️', '🚗', '🏠', '💍', '🎓', '🎁']

// goal: existing goal to edit (omit to create). initial: prefill for a new goal.
export function GoalFormModal({ uid, goal, initial = {}, onClose, onSaved }) {
  const { t } = useTranslation()
  const currency = useCurrency()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const src = goal || initial

  const [name, setName] = useState(src.name || '')
  const [emoji, setEmoji] = useState(src.emoji || '🎯')
  const [target, setTarget] = useState(src.targetAmount ? String(src.targetAmount) : '')
  const [date, setDate] = useState(src.targetDate || '')
  const [kind] = useState(src.kind || 'purchase')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const result = normalizeGoalInput({ name, emoji, kind, targetAmount: toNum(target), targetDate: date })
    if (!result.ok) { setError(t(`goals.err.${result.error}`)); return }

    setLoading(true)
    setError('')
    try {
      if (goal) await updateGoal(uid, goal.id, result.goal)
      else await createGoal(uid, result.goal)
      onSaved?.()
      handleClose()
    } catch (err) {
      console.error('[goals] save failed:', err)
      setError(t('goals.err.generic'))
      setLoading(false)
    }
  }

  return (
    <div className={`${base.overlay} ${isClosing ? base.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${base.modal} ${isClosing ? base.modalClosing : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={base.header}>
          <h2 className={base.title}>{goal ? t('goals.editGoal') : t('goals.newGoal')}</h2>
        </div>
        <form className={base.form} onSubmit={submit}>
          <div className={base.field}>
            <label className={base.label} htmlFor="g-name">{t('goals.fName')}</label>
            <input id="g-name" className={base.input} type="text" maxLength={60} placeholder={t('goals.fNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className={base.field}>
            <span className={base.label}>{t('goals.fEmoji')}</span>
            <div className={styles.emojis}>
              {EMOJIS.map((em) => (
                <button key={em} type="button" aria-pressed={emoji === em} className={`${styles.emoji} ${emoji === em ? styles.emojiOn : ''}`} onClick={() => setEmoji(em)}>{em}</button>
              ))}
            </div>
          </div>

          <div className={base.field}>
            <label className={base.label} htmlFor="g-target">{t('goals.fTarget')}</label>
            <div className={base.amountWrap}>
              <span className={base.amountCurrency}>{currency}</span>
              <input id="g-target" className={base.amountInput} type="text" inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </div>

          <div className={base.field}>
            <label className={base.label} htmlFor="g-date">{t('goals.fDate')}</label>
            <input id="g-date" className={base.input} type="date" min={toDateStr(new Date())} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {error && <p className={base.error} role="alert">{error}</p>}

          <div className={base.actions}>
            <button type="submit" className={base.saveBtn} disabled={loading}>{loading ? t('goals.saving') : t('goals.save')}</button>
            <button type="button" className={base.cancelBtn} onClick={handleClose}>{t('goals.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// mode: 'add' | 'withdraw'. suggested: optional amount shown as a one-tap chip.
export function ContributeModal({ uid, goal, mode = 'add', suggested = 0, onClose }) {
  const { t } = useTranslation()
  const currency = useCurrency()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    const n = toNum(amount)
    if (n <= 0) { setError(t('goals.err.target')); return }
    setLoading(true)
    setError('')
    try {
      await addContribution(uid, goal, mode === 'withdraw' ? -n : n, note)
      handleClose()
    } catch (err) {
      console.error('[goals] contribution failed:', err)
      setError(err.message && /withdraw/i.test(err.message) ? err.message : t('goals.err.generic'))
      setLoading(false)
    }
  }

  const title = fillText(t(mode === 'withdraw' ? 'goals.withdrawTitle' : 'goals.contributeTitle'), { name: goal.name })

  return (
    <div className={`${base.overlay} ${isClosing ? base.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${base.modal} ${isClosing ? base.modalClosing : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={base.header}>
          <h2 className={base.title}>{goal.emoji || '🎯'} {title}</h2>
        </div>
        <form className={base.form} onSubmit={submit}>
          <div className={base.field}>
            <label className={base.label} htmlFor="c-amount">{t('goals.amount')}</label>
            <div className={base.amountWrap}>
              <span className={base.amountCurrency}>{currency}</span>
              <input id="c-amount" className={base.amountInput} type="text" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
            {mode === 'add' && suggested > 0 && (
              <button type="button" className={styles.chip} onClick={() => setAmount(String(Math.round(suggested)))}>
                {t('goals.suggested')}: {currency} {fillText('{v}', { v: suggested })}
              </button>
            )}
          </div>

          <div className={base.field}>
            <label className={base.label} htmlFor="c-note">{t('goals.note')}</label>
            <input id="c-note" className={base.input} type="text" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className={base.error} role="alert">{error}</p>}

          <div className={base.actions}>
            <button type="submit" className={base.saveBtn} disabled={loading}>{loading ? t('goals.saving') : t('goals.save')}</button>
            <button type="button" className={base.cancelBtn} onClick={handleClose}>{t('goals.cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
