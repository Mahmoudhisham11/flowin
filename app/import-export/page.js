'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { UploadIcon, DownloadIcon } from '@/components/Icons'
import styles from './page.module.css'

export default function ImportExportPage() {
  const [isDragOver, setIsDragOver] = useState(false)
  const { t } = useTranslation()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('importExport.title')}</h1>
          <p className={styles.subtitle}>{t('importExport.subtitle')}</p>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardIcon}>
            <UploadIcon width="24" height="24" />
          </div>
          <h2 className={styles.cardTitle}>{t('importExport.importTitle')}</h2>
          <p className={styles.cardDesc}>{t('importExport.importDesc')}</p>
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropActive : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false) }}
          >
            <UploadIcon width="28" height="28" />
            <p className={styles.dropText}>{t('importExport.dragDrop')}</p>
            <p className={styles.dropHint}>{t('importExport.clickBrowse')}</p>
          </div>
          <div className={styles.formatInfo}>
            <span className={styles.formatBadge}>CSV</span>
            <span className={styles.formatBadge}>QIF</span>
            <span className={styles.formatBadge}>OFX</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardIcon}>
            <DownloadIcon width="24" height="24" />
          </div>
          <h2 className={styles.cardTitle}>{t('importExport.exportTitle')}</h2>
          <p className={styles.cardDesc}>{t('importExport.exportDesc')}</p>
          <div className={styles.exportList}>
            <button className={styles.exportBtn}>
              <div className={styles.exportInfo}>
                <span className={styles.exportName}>{t('importExport.exportCSV')}</span>
                <span className={styles.exportSize}>All transactions</span>
              </div>
              <DownloadIcon width="18" height="18" />
            </button>
            <button className={styles.exportBtn}>
              <div className={styles.exportInfo}>
                <span className={styles.exportName}>{t('importExport.exportPDF')}</span>
                <span className={styles.exportSize}>Summary report</span>
              </div>
              <DownloadIcon width="18" height="18" />
            </button>
            <button className={styles.exportBtn}>
              <div className={styles.exportInfo}>
                <span className={styles.exportName}>{t('importExport.exportQIF')}</span>
                <span className={styles.exportSize}>For accounting software</span>
              </div>
              <DownloadIcon width="18" height="18" />
            </button>
          </div>
        </div>

        <div className={`${styles.card} ${styles.infoCard}`}>
          <div className={styles.cardIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <h2 className={styles.cardTitle}>{t('importExport.backupTitle')}</h2>
          <p className={styles.cardDesc}>Your data is automatically backed up to the cloud. You can also create a manual backup.</p>
          <div className={styles.backupInfo}>
            <div className={styles.backupRow}>
              <span className={styles.backupLabel}>{t('importExport.lastBackup')}</span>
              <span className={styles.backupValue}>{t('importExport.noBackup')}</span>
            </div>
            <div className={styles.backupRow}>
              <span className={styles.backupLabel}>{t('importExport.storageUsed')}</span>
              <span className={styles.backupValue}>0 MB / 50 MB</span>
            </div>
          </div>
          <button className={styles.backupBtn}>
            <DownloadIcon width="18" height="18" />
            {t('importExport.createBackup')}
          </button>
        </div>
      </div>
    </div>
  )
}
