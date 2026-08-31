'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { subscribeToWallets } from '@/services/walletService'
import { subscribeToBudget } from '@/services/budgetService'
import { MicIcon } from '@/components/Icons'
import VoiceResultPreview from './VoiceResultPreview'
import useVoiceExpense, { STEPS } from '@/hooks/useVoiceExpense'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './VoiceButton.module.css'

export default function VoiceButton() {
  const { t } = useTranslation()
  const { user } = useUser()
  const [recLang, setRecLang] = useState('ar-EG')
  const [wallets, setWallets] = useState([])
  const [budgetCategories, setBudgetCategories] = useState([])
  const [elapsed, setElapsed] = useState(0)
  const budgetRef = useRef([])
  const timerRef = useRef(null)
  const voice = useVoiceExpense()

  useEffect(() => {
    budgetRef.current = budgetCategories
  }, [budgetCategories])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToWallets(user.uid, setWallets)
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToBudget(user.uid, (data) => {
      setBudgetCategories(data?.essentialCategories || [])
    })
    return unsub
  }, [user])

  // Timer for recording state
  useEffect(() => {
    if (voice.step === STEPS.RECORDING) {
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [voice.step])

  const handleStart = () => {
    voice.startRecording(recLang, budgetRef.current, wallets)
  }

  const handleClose = () => {
    voice.cancel()
  }

  const handleDone = async (walletId) => {
    await voice.confirmExpenses(walletId, wallets)
  }

  const handleDoneAndClose = () => {
    voice.reset()
  }

  const formatTimer = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <>
      {/* 1. Default Idle Trigger Button */}
      {voice.step === STEPS.IDLE && !voice.error && (
        <button
          className={styles.fab}
          onClick={handleStart}
          aria-label="تسجيل مصروف بالصوت"
        >
          <div className={styles.fabGlow} />
          <div className={styles.fabIcon}>
            <MicIcon />
          </div>
          <span className={styles.fabLabel}>{t('voice.title') || 'تسجيل صوتي'}</span>
        </button>
      )}

      {/* 2. Recording State: Smooth In-Place Floating Soundbar (No Popup) */}
      {voice.step === STEPS.RECORDING && (
        <div className={styles.recordingBar}>
          {/* Live Floating Speech Preview */}
          {voice.transcript ? (
            <div className={styles.floatingTranscript}>
              <p className={styles.floatingTranscriptText} dir={recLang.startsWith('ar') ? 'rtl' : 'ltr'}>
                {voice.transcript}
              </p>
            </div>
          ) : (
            <div className={styles.floatingHint}>
              <span className={styles.pulseDot} />
              <span>{recLang.startsWith('ar') ? 'تحدث الآن... (مثال: صرفت 50 جنيه قهوة)' : 'Speak now... (e.g. Spent 50 on coffee)'}</span>
            </div>
          )}

          <div className={styles.recordingContent}>
            {/* Language Switch */}
            <button
              type="button"
              className={styles.langPill}
              onClick={() => {
                const next = recLang.startsWith('ar') ? 'en-US' : 'ar-EG'
                setRecLang(next)
                voice.startRecording(next, budgetRef.current, wallets)
              }}
            >
              {recLang.startsWith('ar') ? 'EN' : 'عربي'}
            </button>

            {/* Pulsing Wave Animation & Timer */}
            <div className={styles.waveSection} onClick={voice.stopRecording}>
              <div className={styles.timerBadge}>
                <span className={styles.recordingDot} />
                <span>{formatTimer(elapsed)}</span>
              </div>
              <div className={styles.soundWaves}>
                <span className={styles.waveBar} />
                <span className={styles.waveBar} />
                <span className={styles.waveBar} />
                <span className={styles.waveBar} />
                <span className={styles.waveBar} />
                <span className={styles.waveBar} />
              </div>
            </div>

            {/* Finish/Stop Recording Button */}
            <button
              type="button"
              className={styles.finishRecordBtn}
              onClick={voice.stopRecording}
              title="إنهاء وحفظ"
            >
              <div className={styles.finishRecordIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="3" />
                </svg>
              </div>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              className={styles.cancelRecordBtn}
              onClick={handleClose}
              title="إلغاء"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 3. Processing State: Smooth Compact Floating Pill */}
      {voice.step === STEPS.PROCESSING && (
        <div className={styles.processingBar}>
          <div className={styles.processingSpinner} />
          <div className={styles.processingInfo}>
            <span className={styles.processingLabel}>{t('voice.processing') || 'جاري استخراج المعاملات...'}</span>
            {voice.transcript && (
              <span className={styles.processingSnippet}>&ldquo;{voice.transcript}&rdquo;</span>
            )}
          </div>
        </div>
      )}

      {/* 4. Preview State: Bottom Sheet Confirmation */}
      {voice.step === STEPS.PREVIEW && voice.expenses.length > 0 && (
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <VoiceResultPreview
              expenses={voice.expenses}
              wallets={wallets}
              onConfirm={handleDone}
              onUpdate={voice.updateExpense}
              onRemove={voice.removeExpense}
              onCancel={handleClose}
              budgetCategories={budgetCategories}
            />
          </div>
        </div>
      )}

      {/* 5. Saving / Done States */}
      {(voice.step === STEPS.SAVING || voice.step === STEPS.DONE) && (
        <div className={styles.overlay}>
          <div className={styles.modalSmall} onClick={(e) => e.stopPropagation()}>
            {voice.step === STEPS.SAVING ? (
              <div className={styles.savingBlock}>
                <div className={styles.processingSpinnerLarge} />
                <p className={styles.processingText}>{t('voice.savingExpense') || 'جاري حفظ المعاملات...'}</p>
              </div>
            ) : (
              <div className={styles.savingBlock}>
                <div className={styles.successIcon}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <p className={styles.processingText}>{t('voice.saved') || 'تم الحفظ بنجاح!'}</p>
                <button className={styles.closeBtn} onClick={handleDoneAndClose}>
                  {t('done') || 'تم'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Error State: Floating Notification Pill */}
      {voice.step === STEPS.IDLE && voice.error && (
        <div className={styles.floatingError}>
          <div className={styles.errorIconSmall}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <span className={styles.errorText}>{voice.error}</span>
          <button className={styles.errorRetryBtn} onClick={handleStart}>
            {t('retry') || 'إعادة'}
          </button>
          <button className={styles.errorCloseBtn} onClick={handleClose}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}
