'use client'

import { useState } from 'react'
import { useTranslation } from '@/hooks/useTranslation'
import { generateInsight } from '@/services/insightsEngine'
import { getCategory } from '@/lib/categories'
import AnimatedNumber from './AnimatedNumber'
import styles from './InsightsCard.module.css'

const RISK_COLORS = {
  Low: { bg: '#F0FDF4', text: '#22C55E', dot: '#22C55E' },
  Medium: { bg: '#FEF3C7', text: '#F59E0B', dot: '#F59E0B' },
  High: { bg: '#FEF2F2', text: '#EF4444', dot: '#EF4444' },
}

export default function InsightsCard({ uid, insight, loading: hookLoading }) {
  const { t } = useTranslation()
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    setGenerating(true)
    setError('')
    try {
      await generateInsight(uid)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (hookLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.headerSkeleton} />
        <div className={styles.bodySkeleton} />
      </div>
    )
  }

  if (!insight) {
    return (
      <div className={styles.card}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('insights.emptyDescription')}</p>
          <button className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
            {generating ? t('insights.analyzing') : t('insights.generate')}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      </div>
    )
  }

  const risk = RISK_COLORS[insight.riskLevel] || RISK_COLORS.Low
  const category = insight.topCategory ? getCategory(insight.topCategory) : null

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <span className={styles.weekId}>{insight.weekId}</span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={handleGenerate} disabled={generating} title={t('common.refresh')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={generating ? styles.spin : ''}>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {insight.totalSpent > 0 && (
        <div className={styles.mainStat}>
                  <span className={styles.mainLabel}>{t('analytics.totalSpent')}</span>
                  <span className={styles.mainValue}>EGP <AnimatedNumber value={insight.totalSpent} decimals={0} /></span>
        </div>
      )}

      {category && insight.topCategoryPercentage > 0 && (
        <div className={styles.categoryRow}>
          <span className={styles.categoryEmoji}>{category.emoji}</span>
          <div className={styles.categoryBar}>
            <div className={styles.categoryBarTrack}>
              <div className={styles.categoryBarFill} style={{ width: `${Math.min(insight.topCategoryPercentage, 100)}%` }} />
            </div>
            <span className={styles.categoryLabel}>
              {category.labelEn} - {insight.topCategoryPercentage}% {t('common.of')} {t('analytics.totalSpent')}
            </span>
          </div>
        </div>
      )}

      <p className={styles.insightText}>{insight.insight}</p>

      {insight.walletAnalysis && (
        <p className={styles.walletText}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
          </svg>
          {insight.walletAnalysis}
        </p>
      )}

      <div className={styles.recommendSection}>
        <div className={styles.recommendHeader}>
          <span className={styles.recommendLabel}>{t('insights.recommendation')}</span>
          <span className={styles.riskBadge} style={{ background: risk.bg, color: risk.text }}>
            <span className={styles.riskDot} style={{ background: risk.dot }} />
            {insight.riskLevel} {t('insights.riskLevel')}
          </span>
        </div>
        <p className={styles.recommendText}>{insight.recommendation}</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

