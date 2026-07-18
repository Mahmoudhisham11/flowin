'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { CheckIcon, DownloadIcon } from '@/components/Icons'
import Button from '@/components/ui/Button'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function ReceiptPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const amount = searchParams.get('amount') || '0.00'

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.successIcon}>
          <CheckIcon />
        </div>

        <h1 className={styles.title}>{t('receipt.transferSuccess')}</h1>

        <div className={styles.amountSection}>
          <span className={styles.currency}>$</span>
          <span className={styles.amount}>{amount}</span>
        </div>

        <div className={styles.actions}>
          <Button onClick={() => router.push('/')}>
            {t('done')}
          </Button>
          <Button variant="secondary">
            <DownloadIcon />
            {t('receipt.downloadReceipt')}
          </Button>
        </div>
      </main>
    </div>
  )
}
