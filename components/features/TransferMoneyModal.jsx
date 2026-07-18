'use client'

import { useState } from 'react'
import { doc, collection, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firestore'
import { WALLET_TYPES } from '@/services/walletService'
import { useTranslation } from '@/hooks/useTranslation'
import Select from '@/components/ui/Select'
import styles from './AddIncomeModal.module.css'

export default function TransferMoneyModal({ uid, wallets, onClose }) {
  const { t } = useTranslation()
  const [fromId, setFromId] = useState(wallets.length > 1 ? wallets[0].id : '')
  const [toId, setToId] = useState(wallets.length > 1 ? wallets[1].id : '')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fromWallet = wallets.find((w) => w.id === fromId)
  const toWallet = wallets.find((w) => w.id === toId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError('Enter a valid amount'); return }
    if (!fromId || !toId) { setError('Select both wallets'); return }
    if (fromId === toId) { setError(t('transfer.sameWallet')); return }
    if (fromWallet && Number(fromWallet.balance) < num) { setError(t('wallet.insufficientBalance')); return }

    setLoading(true)
    setError('')
    try {
      const fromRef = doc(db, 'users', uid, 'wallets', fromId)
      const toRef = doc(db, 'users', uid, 'wallets', toId)
      const txRef = doc(collection(db, 'users', uid, 'transactions'))

      await runTransaction(db, async (transaction) => {
        const fromSnap = await transaction.get(fromRef)
        const toSnap = await transaction.get(toRef)
        if (!fromSnap.exists()) throw new Error('Source wallet not found')
        if (!toSnap.exists()) throw new Error('Destination wallet not found')

        const fromBal = Number(fromSnap.data().balance || 0)
        const toBal = Number(toSnap.data().balance || 0)

        if (fromBal < num) throw new Error(`Insufficient balance in ${fromWallet?.name}`)

        transaction.update(fromRef, { balance: fromBal - num })
        transaction.update(toRef, { balance: toBal + num })
        transaction.set(txRef, {
          type: 'transfer',
          amount: num,
          merchant: `→ ${toWallet?.name || 'Transfer'}`,
          category: 'Transfer',
          walletId: fromId,
          toWalletId: toId,
          toWalletName: toWallet?.name,
          currency: 'EGP',
          source: 'transfer',
          createdAt: new Date().toISOString(),
        })
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
          <h2 className={styles.title}>{t('transfer.title')}</h2>
          <p className={styles.subtitle}>Move money between your wallets</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>{t('transfer.from')}</label>
            <Select
              value={fromId}
              onChange={setFromId}
              placeholder="Select source wallet"
              options={wallets.map((w) => {
                const type = WALLET_TYPES.find((wt) => wt.id === w.type)
                return { value: w.id, label: `${w.name} (EGP ${new Intl.NumberFormat('en-US').format(Number(w.balance))})`, icon: type?.emoji }
              })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('transfer.to')}</label>
            <Select
              value={toId}
              onChange={setToId}
              placeholder="Select destination wallet"
              options={wallets.filter((w) => w.id !== fromId).map((w) => {
                const type = WALLET_TYPES.find((wt) => wt.id === w.type)
                return { value: w.id, label: `${w.name} (EGP ${new Intl.NumberFormat('en-US').format(Number(w.balance))})`, icon: type?.emoji }
              })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('transfer.amount')}</label>
            <div className={styles.amountWrap}>
              <span className={styles.amountCurrency}>EGP</span>
              <input className={styles.amountInput} type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
          </div>

          {fromWallet && (
            <div className={styles.preview}>
              <span className={styles.previewLabel}>Available Balance</span>
              <span className={styles.previewValue}>EGP {new Intl.NumberFormat('en-US').format(Number(fromWallet.balance))}</span>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading || !fromId || !toId || fromId === toId}>
              {loading ? t('saving') : t('transfer.transferNow')}
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

