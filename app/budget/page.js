'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon, EditIcon } from '@/components/Icons'
import { subscribeToBudget, saveBudget, generateAIDailyBudget } from '@/services/budgetService'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function BudgetPage() {
  const { user } = useUser()
  const { t, language } = useTranslation()
  const [budget, setBudget] = useState(null)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editingAmount, setEditingAmount] = useState(null)
  const [aiDailyBudget, setAiDailyBudget] = useState(null)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToBudget(user.uid, (data) => {
      if (data) {
        setBudget(data)
        setMonthlyIncome(data.monthlyIncome || 0)
        setCategories(data.essentialCategories || [])
        if (data.aiDailyBudget) {
          setAiDailyBudget(data.aiDailyBudget)
        }
      } else {
        setBudget(null)
        setMonthlyIncome(0)
        setCategories([])
        setAiDailyBudget(null)
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

  const handleGenerateAI = async () => {
    if (incomeNum <= 0) {
      setAiError(t('budget.needIncomeFirst'))
      setTimeout(() => setAiError(''), 4000)
      return
    }

    setGeneratingAI(true)
    setAiError('')
    try {
      const result = await generateAIDailyBudget(
        user?.uid,
        {
          monthlyIncome: incomeNum,
          essentialCategories: categories,
          totalEssentials,
          remaining,
        },
        language || 'ar'
      )
      setAiDailyBudget(result)
    } catch (err) {
      console.error('Failed to generate AI daily budget:', err)
      setAiError(err.message || 'Error generating AI daily budget')
      setTimeout(() => setAiError(''), 4000)
    } finally {
      setGeneratingAI(false)
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

      {/* === AI Daily Budget Card === */}
      {(incomeNum > 0 || aiDailyBudget) && (
        <div className={styles.aiBudgetCard}>
          <div className={styles.aiCardHeader}>
            <div>
              <div className={styles.aiBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {t('budget.aiDailyBudgetTitle')}
              </div>
              <h2 className={styles.aiCardTitle}>{t('budget.dailyBudgetAmount')}</h2>
              <p className={styles.aiCardDesc}>{t('budget.aiDailyBudgetDesc')}</p>
            </div>

            <button
              className={styles.aiGenerateBtn}
              onClick={handleGenerateAI}
              disabled={generatingAI}
            >
              {generatingAI ? (
                <>
                  <div className={styles.spinner} />
                  {t('budget.generating')}
                </>
              ) : aiDailyBudget ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {t('budget.regenerateAiBudget')}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  {t('budget.generateAiBudget')}
                </>
              )}
            </button>
          </div>

          {aiError && (
            <div style={{ color: 'var(--danger)', fontSize: '13px', fontWeight: '600', marginBottom: '16px' }}>
              {aiError}
            </div>
          )}

          {aiDailyBudget && (
            <>
              <div className={styles.dailyHero}>
                <span className={styles.dailyAmount}>EGP {fmt(aiDailyBudget.dailyBudget)}</span>
                <span className={styles.dailyPeriod}>{t('budget.perDay')}</span>
              </div>

              <div className={styles.aiMetricsGrid}>
                <div className={styles.aiMetricCard}>
                  <span className={styles.aiMetricLabel}>{t('budget.safeDailyLimit')}</span>
                  <div className={styles.aiMetricValue} style={{ color: '#22C55E' }}>
                    EGP {fmt(aiDailyBudget.safeDailyLimit || Math.round(aiDailyBudget.dailyBudget * 0.85))}
                  </div>
                </div>

                <div className={styles.aiMetricCard}>
                  <span className={styles.aiMetricLabel}>{t('budget.weekendBuffer')}</span>
                  <div className={styles.aiMetricValue} style={{ color: '#3B82F6' }}>
                    +{fmt(aiDailyBudget.weekendBuffer || 0)}
                  </div>
                </div>

                <div className={styles.aiMetricCard}>
                  <span className={styles.aiMetricLabel}>{t('budget.monthlySavingsBuffer')}</span>
                  <div className={styles.aiMetricValue} style={{ color: '#8B5CF6' }}>
                    EGP {fmt(aiDailyBudget.monthlySavingsBuffer || 0)}
                  </div>
                </div>
              </div>

              {aiDailyBudget.reasoning && (
                <div className={styles.reasoningSection}>
                  <div className={styles.sectionHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    {t('budget.whyThisNumber')}
                  </div>
                  <p className={styles.reasoningText}>{aiDailyBudget.reasoning}</p>
                </div>
              )}

              {Array.isArray(aiDailyBudget.formulaSteps) && aiDailyBudget.formulaSteps.length > 0 && (
                <div className={styles.breakdownSection}>
                  <div className={styles.sectionHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                    {t('budget.formulaBreakdown')}
                  </div>
                  <div className={styles.stepsList}>
                    {aiDailyBudget.formulaSteps.map((step, idx) => (
                      <div key={idx} className={styles.stepRow}>
                        <div className={styles.stepInfo}>
                          <span className={styles.stepName}>{step.step}</span>
                          {step.note && <span className={styles.stepNote}>{step.note}</span>}
                        </div>
                        <span className={`${styles.stepAmount} ${step.amount < 0 ? styles.stepAmountNegative : styles.stepAmountPositive}`}>
                          {step.amount < 0 ? `-EGP ${fmt(Math.abs(step.amount))}` : `EGP ${fmt(step.amount)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(aiDailyBudget.tips) && aiDailyBudget.tips.length > 0 && (
                <div className={styles.tipsSection}>
                  <div className={styles.sectionHeader}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    {t('budget.financialTips')}
                  </div>
                  <ul className={styles.tipsList}>
                    {aiDailyBudget.tips.map((tip, idx) => (
                      <li key={idx} className={styles.tipItem}>
                        <span className={styles.tipBullet} />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
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
                  <div className={styles.catMainRow}>
                    <span className={styles.categoryIndex}>{i + 1}</span>
                    <input
                      className={styles.categoryInput}
                      type="text"
                      value={cat.name}
                      onChange={(e) => updateCategory(i, 'name', e.target.value)}
                      placeholder={t('budget.categoryPlaceholder')}
                    />
                    <button className={styles.removeBtn} onClick={() => removeCategory(i)} aria-label={t('delete')}>
                      <CloseIcon width="14" height="14" />
                    </button>
                  </div>
                  <div className={styles.catDetailsRow}>
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
                        {language === 'ar' ? 'صرفت' : 'Spent'} <strong>EGP {fmt(spent)}</strong>
                      </span>
                    </div>
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
                    {target > 0 && (
                      <div className={styles.remainingBadge} data-over={isOver ? '' : undefined}>
                        {isOver ? `+${fmt(spent - target)}` : `EGP ${fmt(remainingCat)}`}
                      </div>
                    )}
                  </div>
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
