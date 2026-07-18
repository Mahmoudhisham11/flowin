'use client'

import { useTranslation } from '@/hooks/useTranslation'
import styles from './TransactionList.module.css'

function TransactionItem({ name, category, amount, status, color }) {
  const { t } = useTranslation()
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isPositive = amount > 0

  return (
    <div className={styles.item}>
      <div className={styles.avatar} style={{ backgroundColor: color || '#4DA3FF' }}>
        {initials}
      </div>
      <div className={styles.details}>
        <span className={styles.name}>{name}</span>
        <span className={styles.category}>{category}</span>
      </div>
      <div className={styles.right}>
        <span className={`${styles.amount} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? '+' : ''}${Math.abs(amount).toFixed(2)}
        </span>
        <span className={`${styles.status} ${status === 'success' ? styles.success : styles.pending}`}>
          {status === 'success' ? t('common.completed') : t('common.pending')}
        </span>
      </div>
    </div>
  )
}

export default function TransactionList({ transactions }) {
  return (
    <div className={styles.list}>
      {transactions.map((t) => (
        <TransactionItem key={t.id} {...t} />
      ))}
    </div>
  )
}
