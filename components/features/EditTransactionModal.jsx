'use client'

import { useState } from 'react'
import { updateTransaction, deleteTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { refundFromBudget } from '@/services/budgetService'
import { CATEGORIES } from '@/lib/categories'
import { WALLET_TYPES } from '@/services/walletService'
import { useTranslation } from '@/hooks/useTranslation'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './AddIncomeModal.module.css'

export default function EditTransactionModal({ uid, transaction, wallets, onClose, budgetCategories = [] }) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(String(transaction.amount || ''))
  const [category, setCategory] = useState(transaction.category || 'Other')
  const [walletId, setWalletId] = useState(transaction.walletId || (wallets.length > 0 ? wallets[0].id : ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const allCategoryOptions = [
    ...CATEGORIES.map((c) => ({ value: c.id, label: c.id, icon: c.emoji })),
    ...budgetCategories
      .filter((c) => c.name.trim() && !CATEGORIES.some((pc) => pc.id.toLowerCase() === c.name.trim().toLowerCase()))
      .map((c) => ({ value: c.name.trim(), label: c.name.trim(), icon: '📋' })),
  ]

  const handleSave = async (e) => {
    e.preventDefault()
    const num = parseFloat(amount)
    if (!num || num <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError('')
    try {
      const oldAmount = Number(transaction.amount || 0)
      const oldWalletId = transaction.walletId

      const txType = transaction.type || 'expense'

      await updateTransaction(uid, transaction.id, {
        merchant: transaction.merchant || '',
        amount: num,
        category,
        type: txType,
        walletId,
      })

      if (oldWalletId || walletId) {
        const diff = num - oldAmount
        if (oldWalletId && oldWalletId === walletId) {
          if (txType === 'expense') {
            await adjustWallet(uid, walletId, -diff)
          } else {
            await adjustWallet(uid, walletId, diff)
          }
        } else {
          if (oldWalletId) {
            const reverse = txType === 'expense' ? oldAmount : -oldAmount
            await adjustWallet(uid, oldWalletId, reverse)
          }
          if (walletId) {
            const add = txType === 'expense' ? -num : num
            await adjustWallet(uid, walletId, add)
          }
        }
      }

      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setLoading(true)
    try {
      const amt = Number(transaction.amount || 0)
      const txWalletId = transaction.walletId
      const txType = transaction.type
      const txCategory = transaction.category

      await deleteTransaction(uid, transaction.id)

      if (txType === 'expense' && txCategory) {
        refundFromBudget(uid, txCategory, amt).catch((err) => console.error('refundFromBudget error:', err))
      }

      if (txWalletId) {
        const reverse = txType === 'expense' ? amt : -amt
        await adjustWallet(uid, txWalletId, reverse)
      }

      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const adjustWallet = async (uid, wid, delta) => {
    const w = wallets.find((x) => x.id === wid)
    if (!w) return
    const newBalance = Number(w.balance || 0) + delta
    await updateWallet(uid, wid, { balance: newBalance })
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('transactions.editTransaction')}</h2>
          <p className={styles.subtitle}>Update transaction details</p>
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.field}>
            <label className={styles.label}>{t('common.amount')}</label>
            <div className={styles.amountWrap}>
              <span className={styles.amountCurrency}>EGP</span>
              <input className={styles.amountInput} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('transactions.category')}</label>
            <Select
              value={category}
              onChange={setCategory}
              options={allCategoryOptions}
            />
          </div>

          {wallets.length > 0 && (
            <div className={styles.field}>
              <label className={styles.label}>{t('transactions.wallet')}</label>
              <Select
                value={walletId}
                onChange={setWalletId}
                options={wallets.map((w) => {
                  const wt = WALLET_TYPES.find((x) => x.id === w.type)
                  return { value: w.id, label: `${w.name} (EGP ${new Intl.NumberFormat('en-US').format(Number(w.balance))})`, icon: wt?.emoji }
                })}
              />
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : t('common.update')}
            </button>
            <button type="button" className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
                {t('transactions.deleteTransaction')}
              </button>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('transactions.deleteTransaction')}
        message={t('transactions.deleteTransactionMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
