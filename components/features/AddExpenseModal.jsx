'use client'

import { useState, useEffect, useMemo } from 'react'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { fetchTodayState } from '@/services/todayService'
import { computeToday } from '@/lib/planEngine'
import { previewAfterExpense } from '@/lib/purchaseAdvisor'
import { guessCategory, guessEssentialKey } from '@/lib/categoryGuess'
import { fillText } from '@/lib/fillText'
import { toNum } from '@/lib/parseAmount'
import Select from '@/components/ui/Select'
import { WALLET_TYPES } from '@/services/walletService'
import { CATEGORIES } from '@/lib/categories'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import styles from './AddExpenseModal.module.css'
import { useCurrency } from '@/hooks/useCurrency'

const LAST_WALLET_KEY = 'flowin-last-wallet'

function readLastWallet(wallets) {
  try {
    const id = localStorage.getItem(LAST_WALLET_KEY)
    return wallets.some((w) => w.id === id) ? id : null
  } catch {
    return null
  }
}

// initial: optional prefill { amount, reason, category }. preloaded: optional { budget, transactions, today }.
export default function AddExpenseModal({ uid, wallets, onClose, initial = {}, preloaded }) {
  const currency = useCurrency()
  const { t } = useTranslation()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const [walletId, setWalletId] = useState(() => readLastWallet(wallets) || (wallets.length > 0 ? wallets[0].id : ''))
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial.category || guessCategory(initial.reason) || 'Food')
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial.category))
  const [merchant, setMerchant] = useState('')
  const [reason, setReason] = useState(initial.reason || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [planCtx, setPlanCtx] = useState(preloaded || null)
  const [essentialKey, setEssentialKey] = useState('')
  const [essentialTouched, setEssentialTouched] = useState(false)

  // The user's plan and this period's spending: gives the fixed-expense list and the live preview.
  useEffect(() => {
    if (preloaded) return
    let cancelled = false
    fetchTodayState(uid)
      .then((state) => { if (!cancelled) setPlanCtx(state) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [uid, preloaded])

  const essentials = planCtx?.budget?.planVersion ? planCtx.budget.essentialCategories || [] : []
  const num = toNum(amount)

  const preview = useMemo(() => {
    if (!planCtx?.budget?.planVersion || num <= 0) return null
    const after = previewAfterExpense(computeToday, planCtx.budget, planCtx.transactions, {
      amount: num,
      category,
      essentialKey: essentialKey || undefined,
    })
    return after.hasPlan ? after : null
  }, [planCtx, num, category, essentialKey])

  const handleTextChange = (nextReason, nextMerchant) => {
    if (!categoryTouched) {
      const guess = guessCategory(nextReason, nextMerchant)
      if (guess) setCategory(guess)
    }
    if (!essentialTouched) {
      setEssentialKey(guessEssentialKey(essentials, nextReason, nextMerchant) || '')
    }
  }

  const impact = (() => {
    if (!preview) return null
    const money = (n) => `${currency} ${fillText('{v}', { v: n })}`
    const freeUsed = preview.spentTotal - (planCtx.today?.spentTotal || 0)
    if (freeUsed <= 0) return { cls: styles.impactInfo, text: t('quick.afterFixed') }
    if (preview.status === 'depleted') return { cls: styles.impactBad, text: t('quick.afterDepleted') }
    if (preview.remainingToday < 0) {
      return { cls: styles.impactBad, text: fillText(t('quick.afterOver'), { over: money(-preview.remainingToday) }) }
    }
    return {
      cls: preview.status === 'caution' ? styles.impactWarn : styles.impactOk,
      text: fillText(t('quick.afterOk'), { left: money(preview.remainingToday) }),
    }
  })()

  const selectedWallet = wallets.find((w) => w.id === walletId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!walletId) { setError('Select a wallet'); return }
    if (!num || num <= 0) { setError('Enter a valid amount'); return }

    setLoading(true)
    setError('')
    try {
      await saveTransaction(uid, {
        amount: num,
        currency,
        category,
        merchant: merchant.trim(),
        reason: reason.trim(),
        type: 'expense',
        source: 'manual',
        ...(essentialKey ? { essentialKey } : {}),
        walletId,
        walletName: selectedWallet?.name || '',
      })

      await updateWallet(uid, walletId, {
        balance: (selectedWallet?.balance || 0) - num,
      })

      try { localStorage.setItem(LAST_WALLET_KEY, walletId) } catch {}
      handleClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${isClosing ? styles.modalClosing : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('expense.title')}</h2>
          <p className={styles.subtitle}>Record a new expense</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>{t('income.wallet')}</label>
            <div className={styles.walletGrid}>
              {wallets.map((w) => {
                const wt = WALLET_TYPES.find((t) => t.id === w.type)
                const active = walletId === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`${styles.walletBtn} ${active ? styles.walletActive : ''}`}
                    onClick={() => setWalletId(w.id)}
                  >
                    <span className={styles.walletEmoji}>{wt?.emoji || '💳'}</span>
                    <div className={styles.walletInfo}>
                      <span className={styles.walletName}>{w.name}</span>
                      <span className={styles.walletBalance}>{currency} {new Intl.NumberFormat('en-US').format(Number(w.balance || 0))}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('income.amount')}</label>
            <div className={styles.amountWrap}>
              <span className={styles.amountCurrency}>{currency}</span>
              <input
                className={styles.amountInput}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('expense.reason')}</label>
            <input
              className={styles.input}
              type="text"
              placeholder={t('expense.reasonPlaceholder')}
              value={reason}
              onChange={(e) => { setReason(e.target.value); handleTextChange(e.target.value, merchant) }}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('expense.category')}</label>
            <div className={styles.categoryGrid}>
              {CATEGORIES.filter((c) => c.id !== 'Transfer').map((c) => {
                const active = category === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.categoryBtn} ${active ? styles.categoryActive : ''}`}
                    style={active ? { borderColor: c.color, background: c.color + '15' } : {}}
                    onClick={() => { setCategory(c.id); setCategoryTouched(true) }}
                  >
                    <span className={styles.categoryEmoji}>{c.emoji}</span>
                    <span className={styles.categoryName}>{c.labelEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {essentials.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>{t('today.fixedExpense')}</label>
              <Select
                value={essentialKey}
                onChange={(v) => { setEssentialKey(v); setEssentialTouched(true) }}
                options={[
                  { value: '', label: t('today.fixedExpenseNone') },
                  ...essentials.map((e) => ({ value: e.presetId || e.name, label: e.name })),
                ]}
              />
              {essentialKey && <p className={styles.subtitle}>{t('today.fixedExpenseHint')}</p>}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>{t('expense.merchant')}</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Restaurant, Store..."
              value={merchant}
              onChange={(e) => { setMerchant(e.target.value); handleTextChange(reason, e.target.value) }}
            />
          </div>

          {selectedWallet && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>{t('expense.newBalance')}</span>
              <span className={styles.previewValue}>
                {WALLET_TYPES.find((t) => t.id === selectedWallet.type)?.emoji} {currency} {new Intl.NumberFormat('en-US').format(((selectedWallet.balance || 0) - (parseFloat(amount) || 0)))}
              </span>
            </div>
          )}

          {impact && <div className={`${styles.impact} ${impact.cls}`} role="status">{impact.text}</div>}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : t('expense.add')}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={handleClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
