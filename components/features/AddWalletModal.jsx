'use client'

import { useState } from 'react'
import { createWallet, updateWallet, deleteWallet, WALLET_TYPES, WALLET_COLORS } from '@/services/walletService'
import { toNum } from '@/lib/parseAmount'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import styles from './AddWalletModal.module.css'
import { useCurrency } from '@/hooks/useCurrency'

// intro: optional { title, body } shown above the form (used when the first wallet is required).
// onSaved: called after a successful create/update, before the modal closes.
export default function AddWalletModal({ uid, wallet, onClose, onSaved, intro }) {
  const currency = useCurrency()
  const { t } = useTranslation()
  const { isClosing, handleClose } = useSmoothClose(onClose)
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
    if (!name.trim()) { setError(t('money.walletName')); return }
    setLoading(true)
    setError('')
    try {
      const newBalance = toNum(balance)
      if (isEdit) {
        // Editing the balance corrects it; it is not recorded as income or spending.
        await updateWallet(uid, wallet.id, {
          name: name.trim(),
          type,
          color,
          ...(String(balance) !== String(wallet.balance ?? '') ? { balance: newBalance } : {}),
        })
      } else {
        // The opening balance is money you already had, not income: no transaction is recorded.
        await createWallet(uid, {
          name: name.trim(),
          type,
          balance: newBalance,
          color,
          currency,
        })
      }
      onSaved?.()
      handleClose()
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
      handleClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const activeType = WALLET_TYPES.find((t) => t.id === type)

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${isClosing ? styles.modalClosing : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? t('dashboard.editWallet') : t('dashboard.addWallet')}</h2>
          <p className={styles.subtitle}>{isEdit ? t('money.walletEditSub') : t('money.walletNewSub')}</p>
        </div>

        {intro && (
          <div className={styles.intro} role="note">
            <strong>{intro.title}</strong>
            <span>{intro.body}</span>
          </div>
        )}

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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="wallet-balance">{t('money.currentBalance')} ({currency})</label>
            <input id="wallet-balance" className={styles.input} type="text" inputMode="decimal" placeholder="0" value={balance} onChange={(e) => setBalance(e.target.value)} />
            {isEdit && <span className={styles.hint}>{t('money.balanceHint')}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>{t('money.color')}</label>
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
            {isEdit ? (
              <div className={styles.secondaryActions}>
                <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('dashboard.deleteWallet')}
                </button>
              </div>
            ) : (
              <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                {t('cancel')}
              </button>
            )}
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

