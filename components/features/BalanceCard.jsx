'use client'

import { useTranslation } from '@/hooks/useTranslation'
import { EyeIcon, EyeOffIcon } from '@/components/Icons'
import AnimatedNumber from './AnimatedNumber'
import styles from './BalanceCard.module.css'

export default function BalanceCard({ balance, showBalance, onToggle }) {
  const { t } = useTranslation()
  return (
    <div className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.label}>{t('dashboard.totalBalance')}</span>
        <button className={styles.toggleBtn} onClick={onToggle}>
          {showBalance ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      <h2 className={styles.balance}>
        {showBalance ? (
          <AnimatedNumber value={balance} prefix="EGP " decimals={0} />
        ) : (
          '••••••'
        )}
      </h2>
      <div className={styles.bottomRow}>
        <span className={styles.accountLabel}>{t('dashboard.wallets')}</span>
      </div>
    </div>
  )
}

