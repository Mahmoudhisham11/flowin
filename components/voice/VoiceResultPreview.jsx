'use client'

import { useState, useCallback } from 'react'
import { getCategory } from '@/lib/categories'
import { useTranslation } from '@/hooks/useTranslation'
import { WALLET_TYPES } from '@/services/walletService'
import Select from '@/components/ui/Select'
import styles from './VoiceResultPreview.module.css'

const CATEGORY_IDS = ['Food', 'Transport', 'Shopping', 'Bills', 'Smoking', 'Entertainment', 'Health', 'Other']

export default function VoiceResultPreview({
  expenses,
  wallets = [],
  onConfirm,
  onUpdate,
  onRemove,
  onCancel,
  budgetCategories = []
}) {
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

  const walletOptions = wallets.map((w) => {
    const wt = WALLET_TYPES.find((x) => x.id === w.type)
    return {
      value: w.id,
      label: `${w.name} (EGP ${new Intl.NumberFormat('en-US').format(Number(w.balance || 0))})`,
      icon: wt?.emoji || '💳'
    }
  })

  const startEdit = (i) => {
    setEditingIndex(i)
    setDraft({ ...expenses[i], walletId: expenses[i].walletId || selectedWalletId })
  }

  const saveEdit = () => {
    if (draft && editingIndex !== null) {
      onUpdate(editingIndex, draft)
    }
    setEditingIndex(null)
    setDraft(null)
  }

  const totalExpense = expenses
    .filter((e) => e.type !== 'income')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const totalIncome = expenses
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)

  const netImpact = totalIncome - totalExpense

  const isEmpty = expenses.length === 0
  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          {expenses.length > 1 ? `${t('voice.confirmTitle')} (${expenses.length})` : t('voice.confirmTitle')}
        </h2>
        <p className={styles.subtitle}>{t('voice.reviewDetails')}</p>
      </div>

      <div className={styles.totalRow}>
        <div className={styles.totalBlock}>
          <span className={styles.totalLabel}>
            {totalExpense > 0 && totalIncome > 0 ? 'صافي العملية (Net)' : totalIncome > 0 ? t('common.income') : t('voice.total')}
          </span>
          <span
            className={styles.totalValue}
            style={{ color: netImpact > 0 ? '#22C55E' : netImpact < 0 ? '#EF4444' : 'var(--text-dark)' }}
          >
            {netImpact > 0 ? '+' : ''}EGP {new Intl.NumberFormat('en-US').format(Math.abs(netImpact || totalExpense))}
          </span>
        </div>
        {totalExpense > 0 && totalIncome > 0 && (
          <div className={styles.subTotals}>
            <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: '600' }}>
              -EGP {new Intl.NumberFormat('en-US').format(totalExpense)}
            </span>
            <span style={{ color: '#22C55E', fontSize: '12px', fontWeight: '600' }}>
              +EGP {new Intl.NumberFormat('en-US').format(totalIncome)}
            </span>
          </div>
        )}
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
              {t('voice.newBalance')}: EGP {new Intl.NumberFormat('en-US').format((selectedWallet.balance || 0) + netImpact)}
            </div>
          )}
        </div>
      )}

      <div className={styles.list}>
        {expenses.map((exp, i) => {
          const isIncome = exp.type === 'income'
          const category = cat(exp.category)
          const isEditing = editingIndex === i
          const itemWallet = wallets.find((w) => w.id === (exp.walletId || selectedWalletId))

          if (isEditing && draft) {
            return (
              <div key={i} className={styles.editCard}>
                <div className={styles.editGrid}>
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>{t('common.amount')}</label>
                    <input
                      className={styles.editInput}
                      type="number"
                      value={draft.amount}
                      onChange={(e) => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>نوع المعاملة</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: draft.type === 'expense' ? '#EF4444' : 'var(--bg)',
                          color: draft.type === 'expense' ? '#fff' : 'var(--text-gray)',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDraft({ ...draft, type: 'expense' })}
                      >
                        مصروف
                      </button>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: draft.type === 'income' ? '#22C55E' : 'var(--bg)',
                          color: draft.type === 'income' ? '#fff' : 'var(--text-gray)',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                        onClick={() => setDraft({ ...draft, type: 'income' })}
                      >
                        دخل
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.editGrid}>
                  <div className={styles.editField}>
                    <label className={styles.editLabel}>التصنيف (Category)</label>
                    <Select
                      value={draft.category}
                      onChange={(v) => setDraft({ ...draft, category: v })}
                      options={allCategoryOptions}
                    />
                  </div>
                  {wallets.length > 0 && (
                    <div className={styles.editField}>
                      <label className={styles.editLabel}>المحفظة</label>
                      <Select
                        value={draft.walletId || selectedWalletId}
                        onChange={(v) => setDraft({ ...draft, walletId: v })}
                        options={walletOptions}
                      />
                    </div>
                  )}
                </div>

                <div className={styles.editField}>
                  <label className={styles.editLabel}>{t('expense.reason')}</label>
                  <input
                    className={styles.editInput}
                    type="text"
                    placeholder={t('expense.reasonPlaceholder')}
                    value={draft.reason || ''}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  />
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
                <div className={styles.itemEmoji} style={{ background: isIncome ? 'rgba(34, 197, 94, 0.15)' : `${category.color}20` }}>
                  <span>{isIncome ? '💰' : category.emoji}</span>
                </div>
                <div className={styles.itemInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={styles.itemCategory}>{exp.category || (isIncome ? 'Income' : category.labelEn)}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isIncome ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isIncome ? '#16A34A' : '#DC2626'
                      }}
                    >
                      {isIncome ? '+ دخل' : '- مصروف'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-gray)', marginTop: '2px' }}>
                    {exp.reason && <span>{exp.reason}</span>}
                    {exp.merchant && <span> · {exp.merchant}</span>}
                    {itemWallet && <span> · 💳 {itemWallet.name}</span>}
                  </div>
                </div>
              </div>
              <div className={styles.itemRight}>
                <span
                  className={styles.itemAmount}
                  style={{ color: isIncome ? '#22C55E' : '#EF4444' }}
                >
                  {isIncome ? '+' : '-'}EGP {new Intl.NumberFormat('en-US').format(Number(exp.amount))}
                </span>
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
