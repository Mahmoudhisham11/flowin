'use client'

import { useState } from 'react'
import { createWallet, updateWallet, deleteWallet, WALLET_TYPES, WALLET_COLORS } from '@/services/walletService'
import { saveTransaction } from '@/services/transactionsService'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './AddWalletModal.module.css'

export default function AddWalletModal({ uid, wallet, onClose }) {
  const { t } = useTranslation()
  const isEdit = !!wallet
  const [name, setName] = useState(wallet?.name || '')
  const [type, setType] = useState(wallet?.type || 'cash')
  const [balance, setBalance] = useState(wallet?.balance !== undefined ? String(wallet.balance) : '')
  const [color, setColor] = useState(wallet?.color || WALLET_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Enter wallet name'); return }
    setLoading(true)
    setError('')
    try {
      if (isEdit) {
        await updateWallet(uid, wallet.id, {
          name: name.trim(),
          type,
          color,
        })
      } else {
        const initBalance = parseFloat(balance) || 0
        await createWallet(uid, {
          name: name.trim(),
          type,
          balance: initBalance,
          color,
          currency: 'EGP',
        })
        if (initBalance > 0) {
          await saveTransaction(uid, {
            type: 'income',
            amount: initBalance,
            category: 'Other',
            merchant: `Initial balance - ${name.trim()}`,
            walletId: null,
            walletName: name.trim(),
            currency: 'EGP',
          })
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
      await deleteWallet(uid, wallet.id)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const activeType = WALLET_TYPES.find((t) => t.id === type)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? t('dashboard.editWallet') : t('dashboard.addWallet')}</h2>
          <p className={styles.subtitle}>{isEdit ? 'Update wallet details' : 'Create a new wallet or account'}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>{t('dashboard.walletName')}</label>
            <input className={styles.input} type="text" placeholder={t('wallet.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!isEdit} />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('dashboard.walletType')}</label>
            <div className={styles.typeGrid}>
              {WALLET_TYPES.map((wt) => (
                <button key={wt.id} type="button" className={`${styles.typeBtn} ${type === wt.id ? styles.typeActive : ''}`} onClick={() => setType(wt.id)}>
                  <span className={styles.typeEmoji}>{wt.emoji}</span>
                  <span className={styles.typeLabel}>{wt.labelAr}</span>
                  <span className={styles.typeSub}>{wt.labelEn}</span>
                </button>
              ))}
            </div>
          </div>

          {!isEdit && (
            <div className={styles.field}>
              <label className={styles.label}>{t('dashboard.initialBalance')}</label>
              <input className={styles.input} type="number" placeholder="0" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Color</label>
            <div className={styles.colorGrid}>
              {WALLET_COLORS.map((c) => (
                <button key={c} type="button" className={`${styles.colorBtn} ${color === c ? styles.colorActive : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('saving') : isEdit ? t('wallet.update') : t('wallet.create')}
            </button>
            {isEdit && (
              <button type="button" className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)} disabled={loading}>
                {t('dashboard.deleteWallet')}
              </button>
            )}
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{t('cancel')}</button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('dashboard.deleteWallet')}
        message={t('dashboard.deleteWalletMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}

