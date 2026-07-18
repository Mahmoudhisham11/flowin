'use client'

import { useState } from 'react'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { WALLET_TYPES } from '@/services/walletService'
import { CATEGORIES } from '@/lib/categories'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './AddExpenseModal.module.css'

export default function AddExpenseModal({ uid, wallets, onClose }) {
  const { t } = useTranslation()
  const [walletId, setWalletId] = useState(wallets.length > 0 ? wallets[0].id : '')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [merchant, setMerchant] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedWallet = wallets.find((w) => w.id === walletId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!walletId) { setError('Select a wallet'); return }
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError('Enter a valid amount'); return }

    setLoading(true)
    setError('')
    try {
      await saveTransaction(uid, {
        amount: num,
        currency: 'EGP',
        category,
        merchant: merchant.trim(),
        type: 'expense',
        source: 'manual',
        walletId,
        walletName: selectedWallet?.name || '',
      })

      await updateWallet(uid, walletId, {
        balance: (selectedWallet?.balance || 0) - num,
      })

      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                      <span className={styles.walletBalance}>EGP {new Intl.NumberFormat('en-US').format(Number(w.balance || 0))}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('income.amount')}</label>
            <div className={styles.amountWrap}>
              <span className={styles.amountCurrency}>EGP</span>
              <input
                className={styles.amountInput}
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
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
                    onClick={() => setCategory(c.id)}
                  >
                    <span className={styles.categoryEmoji}>{c.emoji}</span>
                    <span className={styles.categoryName}>{c.labelEn}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('expense.merchant')}</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Restaurant, Store..."
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
            />
          </div>

          {selectedWallet && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>{t('expense.newBalance')}</span>
              <span className={styles.previewValue}>
                {WALLET_TYPES.find((t) => t.id === selectedWallet.type)?.emoji} EGP {new Intl.NumberFormat('en-US').format(((selectedWallet.balance || 0) - (parseFloat(amount) || 0)))}
              </span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : t('expense.add')}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
