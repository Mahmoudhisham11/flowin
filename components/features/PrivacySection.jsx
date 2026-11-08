'use client'

import { useState } from 'react'
import Link from 'next/link'
import { exportMyData, deleteMyAccount } from '@/services/accountService'
import { useUser } from '@/contexts/UserContext'
import { useTranslation } from '@/hooks/useTranslation'
import useSmoothClose from '@/hooks/useSmoothClose'
import base from './AddExpenseModal.module.css'
import styles from './PrivacySection.module.css'

function DeleteDialog({ onClose }) {
  const { t } = useTranslation()
  const { logout } = useUser()
  const { isClosing, handleClose } = useSmoothClose(onClose)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [needsReauth, setNeedsReauth] = useState(false)

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteMyAccount()
      await logout()
    } catch (err) {
      if (err.code === 'REAUTH') {
        setNeedsReauth(true)
        setError(t('privacy.reauth'))
      } else {
        setError(err.message && err.code !== undefined ? err.message : t('privacy.failed'))
      }
      setBusy(false)
    }
  }

  return (
    <div className={`${base.overlay} ${isClosing ? base.overlayClosing : ''}`} onClick={handleClose}>
      <div className={`${base.modal} ${isClosing ? base.modalClosing : ''}`} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={t('privacy.deleteTitle')}>
        <div className={base.header}>
          <h2 className={base.title}>{t('privacy.deleteTitle')}</h2>
          <p className={base.subtitle}>{t('privacy.deleteBody')}</p>
        </div>
        <div className={base.form}>
          <div className={base.field}>
            <label className={base.label} htmlFor="del-confirm">{t('privacy.confirmLabel')}</label>
            <input id="del-confirm" className={base.input} type="text" autoComplete="off" dir="ltr" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {error && <p className={base.error} role="alert">{error}</p>}
          <div className={base.actions}>
            {needsReauth ? (
              <button type="button" className={base.saveBtn} onClick={() => logout()}>{t('auth.logout')}</button>
            ) : (
              <button type="button" className={`${base.saveBtn} ${styles.deleteBtn}`} disabled={text !== 'DELETE' || busy} onClick={confirm}>
                {busy ? t('privacy.deleting') : t('privacy.deleteBtn')}
              </button>
            )}
            <button type="button" className={base.cancelBtn} onClick={handleClose} disabled={busy}>{t('privacy.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PrivacySection() {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [showDelete, setShowDelete] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      await exportMyData()
    } catch (err) {
      console.error('[privacy] export failed:', err)
      setError(t('privacy.exportFail'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className={styles.card}>
      <h2 className={styles.title}>{t('privacy.title')}</h2>
      <p className={styles.desc}>{t('privacy.desc')}</p>
      <div className={styles.row}>
        <button type="button" className={styles.btn} onClick={handleExport} disabled={exporting}>
          {exporting ? t('privacy.exporting') : t('privacy.export')}
        </button>
        <button type="button" className={`${styles.btn} ${styles.danger}`} onClick={() => setShowDelete(true)}>
          {t('privacy.delete')}
        </button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.links}>
        <Link href="/privacy">{t('privacy.policy')}</Link>
        <Link href="/terms">{t('privacy.terms')}</Link>
      </div>
      {showDelete && <DeleteDialog onClose={() => setShowDelete(false)} />}
    </section>
  )
}
