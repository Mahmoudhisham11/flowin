'use client'

import { useState, useCallback } from 'react'
import { getCategory } from '@/lib/categories'
import { useTranslation } from '@/hooks/useTranslation'
import { WALLET_TYPES } from '@/services/walletService'
import Select from '@/components/ui/Select'
import styles from './VoiceResultPreview.module.css'

const CATEGORY_IDS = ['Food', 'Transport', 'Shopping', 'Bills', 'Smoking', 'Entertainment', 'Health', 'Other']

function expenseTotal(exps) {
  return exps.reduce((s, e) => s + Number(e.amount || 0), 0)
}

export default function VoiceResultPreview({ expenses, wallets = [], onConfirm, onUpdate, onRemove, onCancel, budgetCategories = [] }) {
  const [editingIndex, setEditingIndex] = useState(null)
  const [draft, setDraft] = useState(null)
  const [selectedWalletId, setSelectedWalletId] = useState(wallets.length > 0 ? wallets[0].id : '')
  const { t } = useTranslation()

  const cat = useCallback((id) => {
    const budgetCat = budgetCategories.find((c) => c.name.trim().toLowerCase() === String(id).trim().toLowerCase())
    if (budgetCat) return { emoji: budgetCat.emoji || '📋', color: '#7C3AED', labelEn: budgetCat.name }
    return getCategory(id)
  }, [budgetCategories])

  const allCategoryOptions = [
    ...CATEGORY_IDS.map((c) => ({ value: c, label: c, icon: cat(c).emoji })),
    ...budgetCategories
      .filter((c) => c.name.trim() && !CATEGORY_IDS.some((id) => id.toLowerCase() === c.name.trim().toLowerCase()))
      .map((c) => ({ value: c.name.trim(), label: c.name.trim(), icon: '📋' })),
  ]

  const startEdit = (i) => {
    setEditingIndex(i)
    setDraft({ ...expenses[i] })
  }

  const saveEdit = () => {
    if (draft && editingIndex !== null) {
      onUpdate(editingIndex, draft)
    }
    setEditingIndex(null)
    setDraft(null)
  }

  const isEmpty = expenses.length === 0
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)
  const total = expenseTotal(expenses)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {expenses.length > 1 ? `${t('voice.confirmTitle')} (${expenses.length})` : t('voice.confirmTitle')}
        </h2>
        <p className={styles.subtitle}>{t('voice.reviewDetails')}</p>
      </div>

      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>{t('voice.total')}</span>
        <span className={styles.totalValue}>EGP {new Intl.NumberFormat('en-US').format(total)}</span>
      </div>

      {wallets.length > 0 && (
        <div className={styles.walletSection}>
          <label className={styles.walletLabel}>{t('voice.deductFrom')}</label>
          <div className={styles.walletOptions}>
            {wallets.map((w) => {
              const wt = WALLET_TYPES.find((t) => t.id === w.type)
              const active = selectedWalletId === w.id
              return (
                <button
                  key={w.id}
                  type="button"
                  className={`${styles.walletOption} ${active ? styles.walletOptionActive : ''}`}
                  onClick={() => setSelectedWalletId(w.id)}
                >
                  <span>{wt?.emoji || '💳'}</span>
                  <div className={styles.walletOptionInfo}>
                    <span className={styles.walletOptionName}>{w.name}</span>
                    <span className={styles.walletOptionBal}>EGP {new Intl.NumberFormat('en-US').format(Number(w.balance || 0))}</span>
                  </div>
                  {active && <span className={styles.walletCheck}>✓</span>}
                </button>
              )
            })}
          </div>
          {selectedWallet && (
            <div className={styles.walletPreview}>
              {t('voice.newBalance')}: EGP {new Intl.NumberFormat('en-US').format((selectedWallet.balance || 0) - total)}
            </div>
          )}
        </div>
      )}

      <div className={styles.list}>
        {expenses.map((exp, i) => {
          const category = cat(exp.category)
          const isEditing = editingIndex === i

          if (isEditing && draft) {
            return (
              <div key={i} className={styles.editCard}>
                <div className={styles.editGrid}>
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>{t('common.amount')}</label>
                    <input className={styles.editInput} type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>Category</label>
                    <Select
                      value={draft.category}
                      onChange={(v) => setDraft({ ...draft, category: v })}
                      options={allCategoryOptions}
                    />
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button className={styles.saveBtn} onClick={saveEdit}>{t('save')}</button>
                  <button className={styles.cancelEditBtn} onClick={() => setEditingIndex(null)}>{t('cancel')}</button>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className={styles.expenseItem}>
              <div className={styles.itemLeft}>
                <div className={styles.itemEmoji} style={{ background: `${category.color}20` }}>
                  <span>{category.emoji}</span>
                </div>
                <div className={styles.itemInfo}>
                  <span className={styles.itemCategory}>{exp.category || category.labelEn}</span>
                  {exp.merchant && <span className={styles.itemMerchant}>{exp.merchant}</span>}
                </div>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.itemAmount}>EGP {new Intl.NumberFormat('en-US').format(Number(exp.amount))}</span>
                <div className={styles.itemActions}>
                  <button className={styles.editItemBtn} onClick={() => startEdit(i)}>{t('edit')}</button>
                  <button className={styles.removeItemBtn} onClick={() => onRemove(i)}>{t('voice.remove')}</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.actions}>
        <button className={styles.confirmBtn} onClick={() => onConfirm(selectedWalletId)} disabled={isEmpty}>
          {expenses.length > 1 ? `${t('voice.saveAll')} (${expenses.length})` : t('voice.confirmSave')}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>{t('cancel')}</button>
      </div>
    </div>
  )
}

