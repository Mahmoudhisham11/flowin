'use client'

import AnimatedNumber from './AnimatedNumber'
import Reveal from './Reveal'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './DailyBudgetCard.module.css'

export default function DailyBudgetCard({ limit = 0, spentToday = 0, onSetBudget, onAddExpense }) {
  const { t, isAr } = useTranslation()

  const hasLimit = limit > 0
  const remaining = Math.max(0, limit - spentToday)
  const isOver = hasLimit && spentToday > limit
  const overAmount = isOver ? spentToday - limit : 0
  const progressPct = hasLimit ? Math.min((spentToday / limit) * 100, 100) : 0
  const isNearing = hasLimit && !isOver && progressPct >= 75

  let statusClass = styles.statusOnTrack
  let statusText = t('dailyBudget.onTrack')
  let progressColor = 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)'

  if (isOver) {
    statusClass = styles.statusOver
    statusText = `${t('dailyBudget.overBudget')} (${t('dailyBudget.overBy')} ${new Intl.NumberFormat('en-US').format(overAmount)} EGP)`
    progressColor = 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)'
  } else if (isNearing) {
    statusClass = styles.statusNearing
    statusText = t('dailyBudget.nearingLimit')
    progressColor = 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)'
  }

  return (
    <Reveal delay={50}>
      <div className={`${styles.card} ${isOver ? styles.cardOver : ''}`}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.iconWrap}>
              <span>🎯</span>
            </div>
            <div>
              <div className={styles.titleRow}>
                <h3 className={styles.title}>{t('dailyBudget.title')}</h3>
                {hasLimit && (
                  <span className={`${styles.statusBadge} ${statusClass}`}>
                    {statusText}
                  </span>
                )}
              </div>
              <p className={styles.subtitle}>{t('dailyBudget.subtitle')}</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button className={styles.editBtn} onClick={onSetBudget} title={t('dailyBudget.editDailyBudget')}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>{hasLimit ? t('dailyBudget.editDailyBudget') : t('dailyBudget.setDailyBudget')}</span>
            </button>
          </div>
        </div>

        {hasLimit ? (
          <>
            <div className={styles.mainNumbers}>
              <div className={styles.primaryMetric}>
                <span className={styles.metricLabel}>
                  {isOver ? t('dailyBudget.spentToday') : t('dailyBudget.remainingToday')}
                </span>
                <span className={`${styles.remainingValue} ${isOver ? styles.overValue : ''}`}>
                  EGP <AnimatedNumber value={isOver ? spentToday : remaining} decimals={0} />
                </span>
              </div>

              <div className={styles.secondaryMetrics}>
                <div className={styles.secItem}>
                  <span className={styles.secLabel}>{t('dailyBudget.spentToday')}</span>
                  <span className={styles.secValue} style={{ color: '#EF4444' }}>
                    EGP <AnimatedNumber value={spentToday} decimals={0} />
                  </span>
                </div>
                <div className={styles.secDivider} />
                <div className={styles.secItem}>
                  <span className={styles.secLabel}>{t('dailyBudget.dailyLimit')}</span>
                  <span className={styles.secValue}>
                    EGP <AnimatedNumber value={limit} decimals={0} />
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.progressContainer}>
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressBar}
                  style={{
                    width: `${progressPct}%`,
                    background: progressColor,
                  }}
                />
              </div>
              <div className={styles.progressMeta}>
                <span>
                  {Math.round(progressPct)}% {t('dailyBudget.todayProgress')}
                </span>
                <span>
                  {isOver ? (
                    <strong style={{ color: '#EF4444' }}>
                      +{new Intl.NumberFormat('en-US').format(overAmount)} EGP
                    </strong>
                  ) : (
                    <span>
                      {new Intl.NumberFormat('en-US').format(remaining)} EGP {t('common.of')} {new Intl.NumberFormat('en-US').format(limit)} EGP
                    </span>
                  )}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{t('dailyBudget.noLimitYet')}</p>
            <button className={styles.setLimitActionBtn} onClick={onSetBudget}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t('dailyBudget.setDailyBudget')}</span>
            </button>
          </div>
        )}
      </div>
    </Reveal>
  )
}
