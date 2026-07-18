'use client'

import { useState, useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './VoiceRecorder.module.css'

export default function VoiceRecorder({ transcript, currentLang, onStop, onCancel, onRestart }) {
  const { t } = useTranslation()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    setElapsed(0)
  }, [currentLang])

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const isArabic = currentLang?.startsWith('ar')
  const nextLang = isArabic ? 'en-US' : 'ar-EG'

  return (
    <div className={styles.container}>
      <div className={styles.pulse}>
        <div className={styles.pulseInner} />
      </div>

      <p className={styles.status}>
        {t(isArabic ? 'voice.listeningAr' : 'voice.listeningEn')}
      </p>
      <p className={styles.timer}>{formatTime(elapsed)}</p>

      {transcript && (
        <div className={styles.transcriptBox}>
          <p className={styles.transcriptText} dir={isArabic ? 'rtl' : 'ltr'}>{transcript}</p>
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.langBtn} onClick={() => onRestart(nextLang)}>
          {t(isArabic ? 'voice.english' : 'voice.arabic')}
        </button>

        <button className={styles.stopBtn} onClick={onStop}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </button>

        <button className={styles.cancelBtn} onClick={onCancel}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

