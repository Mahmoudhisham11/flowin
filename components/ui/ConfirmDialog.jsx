'use client'

import { useEffect } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import styles from './ConfirmDialog.module.css'

export default function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, confirmColor = '#EF4444', onConfirm, onCancel }) {
  const { t } = useTranslation()
  const { isClosing, handleClose } = useSmoothClose(onCancel)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleClose])

  if (!open) return null

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${styles.dialog} ${isClosing ? styles.dialogClosing : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrap}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={confirmColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={handleClose}>{cancelLabel ?? t('cancel')}</button>
          <button className={styles.confirmBtn} style={{ background: confirmColor }} onClick={onConfirm}>{confirmLabel ?? t('delete')}</button>
        </div>
      </div>
    </div>
  )
}
