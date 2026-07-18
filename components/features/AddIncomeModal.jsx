'use client'

import { useState } from 'react'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { WALLET_TYPES } from '@/services/walletService'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './AddIncomeModal.module.css'

export default function AddIncomeModal({ uid, wallets, onClose }) {
  const { t } = useTranslation()
  const [walletId, setWalletId] = useState(wallets.length > 0 ? wallets[0].id : '')
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedWallet = wallets.find((w) => w.id === walletId)
  const walletType = WALLET_TYPES.find((t) => t.id === selectedWallet?.type)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!walletId) { setError('Select a wallet'); return }
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError('Enter a valid amount'); return }
    if (!source.trim()) { setError('Enter the income source'); return }

    setLoading(true)
    setError('')
    try {
      await saveTransaction(uid, {
        amount: num,
        currency: 'EGP',
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
          <h2 className={styles.title}>{t('income.title')}</h2>
          <p className={styles.subtitle}>Add money to your wallet</p>
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
            <label className={styles.label}>{t('income.source')}</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Salary, Freelance, Gift"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {selectedWallet && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>New balance</span>
              <span className={styles.previewValue}>
                {walletType?.emoji} EGP {new Intl.NumberFormat('en-US').format(((selectedWallet.balance || 0) + (parseFloat(amount) || 0)))}
              </span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : t('income.add')}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

