'use client'

import { useState } from 'react'
import { saveBudget } from '@/services/budgetService'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import styles from './SetDailyBudgetModal.module.css'

export default function SetDailyBudgetModal({ uid, currentLimit = 0, aiSuggestedLimit = 0, onClose }) {
  const { t, isAr } = useTranslation()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const [amount, setAmount] = useState(currentLimit > 0 ? String(currentLimit) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const PRESETS = [100, 200, 300, 500, 1000]

  const handleSubmit = async (e) => {
    e.preventDefault()
    const num = parseFloat(amount)
    if (isNaN(num) || num < 0) {
      setError(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount')
      return
    }
    setLoading(true)
    setError('')
    try {
      await saveBudget(uid, { dailyBudgetLimit: num })
      handleClose()
    } catch (err) {
      setError(err.message || 'Failed to save daily budget')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPreset = (val) => {
    setAmount(String(val))
    setError('')
  }

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ''}`} onClick={handleClose}>
      <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <span>🎯</span>
          </div>
          <div>
            <h2 className={styles.title}>{t('dailyBudget.modalTitle')}</h2>
            <p className={styles.subtitle}>{t('dailyBudget.modalDesc')}</p>
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>&times;</button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputWrap}>
            <label className={styles.label}>{t('dailyBudget.amountLabel')}</label>
            <div className={styles.currencyInput}>
              <span className={styles.currencyPrefix}>EGP</span>
              <input
                type="number"
                step="any"
                min="0"
                className={styles.input}
                placeholder={t('dailyBudget.amountPlaceholder')}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError('')
                }}
                autoFocus
                required
              />
            </div>
          </div>

          <div className={styles.presetSection}>
            <span className={styles.presetLabel}>{t('dailyBudget.quickPresets')}</span>
            <div className={styles.presetButtons}>
              {PRESETS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.presetBtn} ${Number(amount) === val ? styles.presetBtnActive : ''}`}
                  onClick={() => handleSelectPreset(val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {aiSuggestedLimit > 0 && (
            <button
              type="button"
              className={styles.aiSuggestBtn}
              onClick={() => handleSelectPreset(aiSuggestedLimit)}
            >
              <span className={styles.aiSparkle}>✨</span>
              <span>
                {t('dailyBudget.useAiSuggestion')} (<strong>{aiSuggestedLimit} EGP</strong>)
              </span>
            </button>
          )}

          <div className={styles.hint}>
            <span>ℹ️</span> {t('dailyBudget.resetHint')}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={handleClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? t('dailyBudget.saving') : t('dailyBudget.saveLimit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
