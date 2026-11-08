'use client'

import { useState } from 'react'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { WALLET_TYPES } from '@/services/walletService'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import styles from './AddIncomeModal.module.css'
import { useCurrency } from '@/hooks/useCurrency'

// initial: optional prefill { amount, source }
export default function AddIncomeModal({ uid, wallets, onClose, initial = {} }) {
  const currency = useCurrency()
  const { t } = useTranslation()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const [walletId, setWalletId] = useState(wallets.length > 0 ? wallets[0].id : '')
  const [amount, setAmount] = useState(initial.amount ? String(Math.round(initial.amount)) : '')
  const [source, setSource] = useState(initial.source || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedWallet = wallets.find((w) => w.id === walletId)
  const walletType = WALLET_TYPES.find((t) => t.id === selectedWallet?.type)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!walletId) { setError(t('money.selectWallet')); return }
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError(t('money.invalidAmount')); return }
    if (!source.trim()) { setError('Enter the income source'); return }

    setLoading(true)
    setError('')
    try {
      await saveTransaction(uid, {
        amount: num,
        currency,
        category: 'Other',
        merchant: source.trim(),
        type: 'income',
        source: 'manual',
        walletId,
        walletName: selectedWallet?.name || '',
      })

      await updateWallet(uid, walletId, {
        balance: (selectedWallet?.balance || 0) + num,
      })

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
          <h2 className={styles.title}>{t('income.title')}</h2>
          <p className={styles.subtitle}>{t('money.incomeSub')}</p>
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
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('income.source')}</label>
            <input
              className={styles.input}
              type="text"
              placeholder={t('money.incomePh')}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {selectedWallet && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>{t('money.newBalance')}</span>
              <span className={styles.previewValue}>
                {walletType?.emoji} {currency} {new Intl.NumberFormat('en-US').format(((selectedWallet.balance || 0) + (parseFloat(amount) || 0)))}
              </span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : t('income.add')}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={handleClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

