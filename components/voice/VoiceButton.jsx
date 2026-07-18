'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { subscribeToWallets } from '@/services/walletService'
import { subscribeToBudget } from '@/services/budgetService'
import { MicIcon } from '@/components/Icons'
import VoiceRecorder from './VoiceRecorder'
import VoiceResultPreview from './VoiceResultPreview'
import useVoiceExpense, { STEPS } from '@/hooks/useVoiceExpense'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './VoiceButton.module.css'

export default function VoiceButton() {
  const { t } = useTranslation()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [recLang, setRecLang] = useState('ar-EG')
  const [wallets, setWallets] = useState([])
  const [budgetCategories, setBudgetCategories] = useState([])
  const budgetRef = useRef([])
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

  const handleOpen = () => {
    setOpen(true)
    setRecLang('ar-EG')
    voice.startRecording('ar-EG', budgetRef.current)
  }

  const handleClose = () => {
    voice.cancel()
    setOpen(false)
  }

  const handleDone = async (walletId) => {
    await voice.confirmExpenses(walletId)
  }

  const handleDoneAndClose = () => {
    setOpen(false)
    voice.reset()
  }

  return (
    <>
      <button className={styles.fab} onClick={handleOpen}>
        <div className={styles.fabIcon}>
          <MicIcon />
        </div>
        <span className={styles.fabLabel}>{t('voice.title')}</span>
      </button>

      {open && (
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {voice.step === STEPS.RECORDING && (
              <VoiceRecorder
                transcript={voice.transcript}
                currentLang={recLang}
                onStop={voice.stopRecording}
                onCancel={handleClose}
                onRestart={(lang) => {
                  setRecLang(lang)
                  voice.startRecording(lang)
                }}
              />
            )}

            {voice.step === STEPS.PROCESSING && (
              <div className={styles.processing}>
                <div className={styles.spinner} />
                <p className={styles.processingText}>{t('voice.processing')}</p>
                <p className={styles.processingSub}>&ldquo;{voice.transcript}&rdquo;</p>
              </div>
            )}

            {voice.step === STEPS.PREVIEW && voice.expenses.length > 0 && (
              <VoiceResultPreview
                expenses={voice.expenses}
                wallets={wallets}
                onConfirm={handleDone}
                onUpdate={voice.updateExpense}
                onRemove={voice.removeExpense}
                onCancel={handleClose}
                budgetCategories={budgetCategories}
              />
            )}

            {(voice.step === STEPS.SAVING || voice.step === STEPS.DONE) && (
              <div className={styles.processing}>
                {voice.step === STEPS.SAVING ? (
                  <>
                    <div className={styles.spinner} />
                    <p className={styles.processingText}>{t('voice.savingExpense')}</p>
                  </>
                ) : (
                  <>
                    <div className={styles.successIcon}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <p className={styles.processingText}>{t('voice.saved')}</p>
                    <button className={styles.closeBtn} onClick={handleDoneAndClose}>
                      {t('done')}
                    </button>
                  </>
                )}
              </div>
            )}

            {voice.step === STEPS.IDLE && voice.error && (
              <div className={styles.errorState}>
                <div className={styles.errorIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <p className={styles.errorText}>{voice.error}</p>
                <button className={styles.retryBtn} onClick={() => {
                  voice.startRecording(recLang)
                }}>
                  {t('retry')}
                </button>
                <button className={styles.cancelBtn} onClick={handleClose}>
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

