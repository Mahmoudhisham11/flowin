'use client'

import { useState } from 'react'
import { MicIcon } from '@/components/Icons'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function AddExpensePage() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)

  const toggleRecording = () => {
    setIsRecording((prev) => !prev)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('income.title')}</h1>
        <p className={styles.subtitle}>{t('voice.quickLog')}</p>
      </header>

      <div className={styles.main}>
        <button
          className={`${styles.micBtn} ${isRecording ? styles.micActive : ''}`}
          onClick={toggleRecording}
        >
          <MicIcon width="40" height="40" />
        </button>
        <p className={styles.micHint}>
          {isRecording ? t('voice.listening') : t('voice.tapToSpeak')}
        </p>

        <div className={styles.orDivider}>
          <span className={styles.orLine} />
          <span className={styles.orText}>{t('voice.orType')}</span>
          <span className={styles.orLine} />
        </div>

        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            type="text"
            placeholder={t('voice.expensePlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
