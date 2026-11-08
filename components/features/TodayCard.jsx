'use client'

import Link from 'next/link'
import AnimatedNumber from './AnimatedNumber'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import { fillText as fill } from '@/lib/fillText'
import styles from './TodayCard.module.css'

const AR_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربع', 'خميس', 'جمعة', 'سبت']
const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

export default function TodayCard({ today }) {
  const { t, lang } = useTranslation()
  const currency = useCurrency()

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
    status, todayAllowance, remainingToday, spentToday, poolRemaining, freePool, baseDaily,
    daysLeft, weekSpent, weekBudget, weekDays, weekStartIndex, weekLength, dayIndex, period, coach,
  } = today

  const over = remainingToday < 0
  const shown = over ? -remainingToday : remainingToday
  const dayPct = todayAllowance > 0 ? Math.min(100, (spentToday / todayAllowance) * 100) : spentToday > 0 ? 100 : 0
  const showAllowance = (status === 'ok' || status === 'caution' || over) && todayAllowance > 0

  // Seven-day strip: spent days, today highlighted, days to come empty.
  const peak = Math.max(baseDaily * 1.4, ...weekDays, 1)
  const todayInWeek = dayIndex - weekStartIndex
  const dayName = (i) => {
    const d = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() + weekStartIndex + i)
    return lang === 'ar' ? AR_DAYS[d.getDay()] : d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <section className={styles.wrap} data-status={status} aria-live="polite">
      <div className={styles.card}>
        <div className={styles.top}>
          <h2 className={styles.label}>{over ? t('today.overLabel') : t('today.canSpend')}</h2>
          <span className={styles.badge}>{t(`today.status.${status}`)}</span>
        </div>

        <div className={styles.amount}>
          {over && <span className={styles.minus}>−</span>}
          <span className={styles.cur}>{currency}</span>
          <AnimatedNumber value={status === 'none' ? 0 : shown} decimals={0} />
        </div>
        {showAllowance && <p className={styles.of}>{fill(t('today.ofAllowance'), { amount: todayAllowance })}</p>}

        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ width: `${dayPct}%` }} />
        </div>

        {coach && <p className={styles.coach}>{fill(t(`today.coach.${coach.key}`), coach.params)}</p>}
      </div>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>{t('today.freeLeft')}</span>
          <strong>{currency} {fmt(Math.max(0, poolRemaining))}</strong>
          <small>{fill(t('today.ofTotal'), { amount: `${currency} ${fmt(freePool)}` })}</small>
        </div>
        <div className={styles.tile}>
          <span>{t('today.toPayday')}</span>
          <strong>{fill(t('today.daysCount'), { n: daysLeft })}</strong>
          <small>{fill(t('today.payday'), { date: period.end.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }) })}</small>
        </div>
      </div>

      <div className={styles.week}>
        <div className={styles.weekHead}>
          <h3>{t('today.thisWeek')}</h3>
          <span className={weekSpent > weekBudget && weekBudget > 0 ? styles.weekOver : ''}>{currency} {fmt(weekSpent)} / {fmt(weekBudget)}</span>
        </div>
        <div className={styles.bars} aria-hidden="true">
          {Array.from({ length: weekLength }).map((_, i) => {
            const v = weekDays[i]
            const isToday = i === todayInWeek
            const h = v === undefined ? 100 : Math.max(6, (v / peak) * 100)
            const cls = v === undefined ? styles.barFuture : isToday ? styles.barToday : v > baseDaily ? styles.barOver : styles.barPast
            return <span key={i} className={cls} style={{ height: `${h}%` }} />
          })}
        </div>
        <div className={styles.days} aria-hidden="true">
          {Array.from({ length: weekLength }).map((_, i) => (
            <span key={i} className={i === todayInWeek ? styles.dayNow : ''}>{dayName(i)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
