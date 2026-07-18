'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon, EditIcon } from '@/components/Icons'
import { subscribeToBudget, saveBudget } from '@/services/budgetService'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function BudgetPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const [budget, setBudget] = useState(null)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingAmount, setEditingAmount] = useState(null)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToBudget(user.uid, (data) => {
      if (data) {
        setBudget(data)
        setMonthlyIncome(data.monthlyIncome || 0)
        setCategories(data.essentialCategories || [])
      } else {
        setBudget(null)
        setMonthlyIncome(0)
        setCategories([])
      }
    })
    return unsub
  }, [user])

  const totalEssentials = categories.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  const totalSpent = categories.reduce((sum, c) => sum + (Number(c.spent) || 0), 0)
  const remaining = (Number(monthlyIncome) || 0) - totalEssentials
  const incomeNum = Number(monthlyIncome) || 0
  const essentialsPct = incomeNum > 0 ? Math.min((totalEssentials / incomeNum) * 100, 100) : 0
  const savingsPct = incomeNum > 0 ? Math.max(100 - essentialsPct, 0) : 0

  const fmt = (v) => Intl.NumberFormat('en-US').format(Number(v) || 0)

  const addCategory = () => {
    setCategories([...categories, { name: '', amount: 0, spent: 0 }])
  }

  const updateCategory = (index, field, value) => {
    const updated = [...categories]
    updated[index] = { ...updated[index], [field]: value }
    setCategories(updated)
  }

  const removeCategory = (index) => {
    setCategories(categories.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    if (!user) return
    setLoading(true)
    try {
      await saveBudget(user.uid, {
        monthlyIncome: incomeNum,
        essentialCategories: categories.map((c) => ({
          name: c.name.trim(),
          amount: Number(c.amount) || 0,
          spent: Number(c.spent) || 0,
        })),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save budget', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>
                {incomeNum > 0
                  ? `EGP ${fmt(remaining)} ${t('budget.potentialSavings').toLowerCase()}`
                  : t('budget.title')}
              </h1>
              <p className={styles.subtitle}>{t('budget.subtitle')}</p>
            </div>
          </div>
        </header>

        {incomeNum > 0 && (
          <>
            <div className={styles.overview}>
              <div className={`${styles.overviewCard} ${styles.overviewCardAccent} ${styles.overviewIncome}`}>
                <span className={styles.overviewLabel}>{t('budget.monthlyIncome')}</span>
                <div className={styles.overviewValue}>EGP {fmt(incomeNum)}</div>
                <span className={styles.overviewSub}>100%</span>
              </div>
              <div className={`${styles.overviewCard} ${styles.overviewCardAccent} ${styles.overviewEssentials}`}>
                <span className={styles.overviewLabel}>{t('budget.totalEssentials')}</span>
                <div className={styles.overviewValue} style={{ color: 'var(--danger)' }}>EGP {fmt(totalEssentials)}</div>
                <span className={styles.overviewSub}>{essentialsPct.toFixed(0)}% of income</span>
              </div>
              <div className={`${styles.overviewCard} ${styles.overviewCardAccent} ${styles.overviewRemaining}`}>
                <span className={styles.overviewLabel}>{t('budget.potentialSavings')}</span>
                <div className={styles.overviewValue} style={{ color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  EGP {fmt(Math.abs(remaining))}
                </div>
                <span className={styles.overviewSub}>
                  {remaining >= 0 ? `${savingsPct.toFixed(0)}% remaining` : 'overspent'}
                </span>
              </div>
            </div>

            <div className={styles.allocation}>
              <div className={styles.allocationHeader}>
                <span className={styles.allocationTitle}>Allocation</span>
                <span className={styles.allocationPct}>
                  {essentialsPct.toFixed(0)}% Essentials / {savingsPct.toFixed(0)}% Savings
                </span>
              </div>
              <div className={styles.barTrack}>
                {essentialsPct > 0 && (
                  <div className={`${styles.barSegment} ${styles.barEssentials}`} style={{ width: `${essentialsPct}%` }} />
                )}
                {savingsPct > 0 && (
                  <div className={`${styles.barSegment} ${styles.barSavings}`} style={{ width: `${savingsPct}%` }} />
                )}
              </div>
              <div className={styles.barLegend}>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#EF4444' }} />
                  Essentials (EGP {fmt(totalEssentials)})
                </div>
                <div className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: '#4DA3FF' }} />
                  Savings (EGP {fmt(Math.max(remaining, 0))})
                </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.incomeCard}>
          <div className={styles.incomeLabel}>{t('budget.monthlyIncome')}</div>
          <div className={styles.incomeDesc}>{t('budget.incomeDesc')}</div>
          <div className={styles.incomeInputWrap}>
            <span className={styles.incomePrefix}>EGP</span>
            <input
              className={styles.incomeInput}
              type="number"
              value={monthlyIncome || ''}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <div className={styles.essentialsCard}>
          <div className={styles.essentialsHeader}>
            <div>
              <div className={styles.essentialsTitle}>{t('budget.essentials')}</div>
              <div className={styles.essentialsDesc}>{t('budget.essentialsDesc')}</div>
            </div>
            <button className={styles.addBtn} onClick={addCategory}>
              <PlusIcon width="14" height="14" />
              {t('budget.addCategory')}
            </button>
          </div>

          {categories.length > 0 ? (
            <div className={styles.categoryList}>
              {categories.map((cat, i) => {
                const target = Number(cat.amount) || 0
                const spent = Number(cat.spent) || 0
                const remainingCat = target - spent
                const spentPct = target > 0 ? Math.min((spent / target) * 100, 100) : 0
                const isOver = spent > target && target > 0
                return (
                  <div key={i} className={`${styles.categoryItem} ${isOver ? styles.categoryOver : ''}`}>
                    <span className={styles.categoryIndex}>{i + 1}</span>
                    <input
                      className={styles.categoryInput}
                      type="text"
                      value={cat.name}
                      onChange={(e) => updateCategory(i, 'name', e.target.value)}
                      placeholder={t('budget.categoryPlaceholder')}
                    />
                    <div className={styles.amountBlock}>
                      {editingAmount === i ? (
                        <input
                          className={styles.targetInput}
                          type="number"
                          value={cat.amount || ''}
                          onChange={(e) => updateCategory(i, 'amount', e.target.value)}
                          onBlur={() => setEditingAmount(null)}
                          autoFocus
                          placeholder="0"
                        />
                      ) : (
                        <button className={styles.targetDisplay} onClick={() => setEditingAmount(i)}>
                          <span>EGP {fmt(target)}</span>
                          <EditIcon width="12" height="12" />
                        </button>
                      )}
                      <span className={styles.spentBadge}>
                        صرفت <strong>EGP {fmt(spent)}</strong>
                      </span>
                    </div>
                    {target > 0 && (
                      <div className={styles.remainingBadge} data-over={isOver ? '' : undefined}>
                        {isOver ? `+${fmt(spent - target)}` : `EGP ${fmt(remainingCat)}`}
                      </div>
                    )}
                    {target > 0 && (
                      <div className={styles.catProgressWrap}>
                        <div className={styles.catProgressTrack}>
                          <div
                            className={`${styles.catProgressFill} ${isOver ? styles.catProgressOver : spentPct >= 90 ? styles.catProgressDanger : ''}`}
                            style={{ width: `${spentPct}%` }}
                          />
                        </div>
                        <span className={styles.catProgressLabel}>{spentPct.toFixed(0)}%</span>
                      </div>
                    )}
                    <button className={styles.removeBtn} onClick={() => removeCategory(i)}>
                      <CloseIcon width="14" height="14" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <p className={styles.emptyText}>{t('budget.noCategories')}</p>
              <p className={styles.emptyHint}>{t('budget.essentialsDesc')}</p>
            </div>
          )}
        </div>

        <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
          {loading ? t('saving') : saved ? t('budget.saved') : t('budget.savePlan')}
        </button>
    </div>
  )
}
