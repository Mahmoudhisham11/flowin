'use client'

import Link from 'next/link'
import AnimatedNumber from './AnimatedNumber'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import { fillText as fill } from '@/lib/fillText'
import { useAppActions } from '@/contexts/AppActionsContext'
import styles from './TodayCard.module.css'

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

export default function TodayCard({ today }) {
  const { t } = useTranslation()
  const currency = useCurrency()
  const { openModal } = useAppActions()

  if (!today?.hasPlan) {
    return (
      <section className={styles.card} data-status="none">
        <h2 className={styles.setupTitle}>{t('today.noPlanTitle')}</h2>
        <p className={styles.setupSub}>{t('today.noPlanSub')}</p>
        <Link href="/onboarding" className={styles.cta}>{t('today.noPlanCta')}</Link>
      </section>
    )
  }

  const {
    status, todayAllowance, remainingToday, spentToday, poolRemaining, freePool,
    daysLeft, weekSpent, weekBudget, coach,
  } = today

  const over = remainingToday < 0
  const shown = over ? -remainingToday : remainingToday
  const dayPct = todayAllowance > 0 ? Math.min(100, (spentToday / todayAllowance) * 100) : spentToday > 0 ? 100 : 0
  const weekPct = weekBudget > 0 ? Math.min(100, (weekSpent / weekBudget) * 100) : 0
  const weekOver = weekSpent > weekBudget && weekBudget > 0

  return (
    <section className={styles.card} data-status={status} aria-live="polite">
      <div className={styles.top}>
        <h2 className={styles.label}>{over ? t('today.overLabel') : t('today.canSpend')}</h2>
        <span className={styles.badge}>{t(`today.status.${status}`)}</span>
      </div>

      <div className={styles.amount}>
        {over && <span className={styles.minus}>−</span>}
        <span className={styles.cur}>{currency}</span>
        <AnimatedNumber value={status === 'none' ? 0 : shown} decimals={0} />
      </div>
      {(status === 'ok' || status === 'caution' || over) && todayAllowance > 0 && (
        <div className={styles.of}>{fill(t('today.ofAllowance'), { amount: todayAllowance })}</div>
      )}

      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${dayPct}%` }} />
      </div>

      {coach && <p className={styles.coach}>{fill(t(`today.coach.${coach.key}`), coach.params)}</p>}

      <div className={styles.stats}>
        <div>
          <strong>{currency} {fmt(Math.max(0, poolRemaining))}</strong>
          <span>{t('today.freeLeft')}</span>
          <small>{currency} {fmt(freePool)}</small>
        </div>
        <div>
          <strong>{daysLeft}</strong>
          <span>{t('today.daysToPayday')}</span>
        </div>
      </div>

      <div className={styles.week}>
        <div className={styles.weekHead}>
          <span>{t('today.thisWeek')}</span>
          <span className={weekOver ? styles.weekOver : ''}>{currency} {fmt(weekSpent)} / {fmt(weekBudget)}</span>
        </div>
        <div className={styles.track} aria-hidden="true">
          <div className={`${styles.fill} ${weekOver ? styles.fillOver : ''}`} style={{ width: `${weekPct}%` }} />
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.buyBtn} onClick={() => openModal('purchase')}>
          🛒 {t('quick.purchase')}
        </button>
        <Link href="/onboarding" className={styles.edit}>{t('today.editPlan')}</Link>
      </div>
      <div className={styles.links}>
        <Link href="/report" className={styles.edit}>{t('nav.weeklyReport')}</Link>
        <Link href="/goals" className={styles.edit}>{t('nav.goals')}</Link>
      </div>
    </section>
  )
}
