'use client'

import { useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useFCM } from '@/hooks/useFCM'
import styles from './FCMNotificationToast.module.css'

export default function FCMNotificationToast() {
  const { user } = useUser()
  const { foregroundNotification, clearNotification } = useFCM(user)

  useEffect(() => {
    if (foregroundNotification) {
      const timer = setTimeout(() => {
        clearNotification()
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [foregroundNotification, clearNotification])

  if (!foregroundNotification) return null

  return (
    <div className={styles.toastContainer}>
      <div className={styles.toast} onClick={clearNotification}>
        <div className={styles.toastIcon}>
          {foregroundNotification.icon ? (
            <img src={foregroundNotification.icon} alt="Notification" className={styles.iconImg} />
          ) : (
            <span>🔔</span>
          )}
        </div>
        <div className={styles.toastContent}>
          <strong className={styles.toastTitle}>{foregroundNotification.title}</strong>
          {foregroundNotification.body && (
            <p className={styles.toastBody}>{foregroundNotification.body}</p>
          )}
        </div>
        <button
          className={styles.closeBtn}
          onClick={(e) => {
            e.stopPropagation()
            clearNotification()
          }}
          aria-label="Close"
        >
          &times;
        </button>
      </div>
    </div>
  )
}
