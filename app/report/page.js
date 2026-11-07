'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { fetchReportData } from '@/services/reportService'
import { buildReport } from '@/lib/reportEngine'
import { getCategory } from '@/lib/categories'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'
import styles from './page.module.css'

const money = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

// Bars: free spending per day. The dashed line is the plan's daily amount; bars above it turn red.
function DayChart({ values, daily, startDate, lang, label, lineLabel }) {
  const W = 320
  const H = 150
  const pad = { l: 4, r: 4, t: 12, b: 22 }
  const max = Math.max(daily * 1.25, ...values, 1)
  const slot = (W - pad.l - pad.r) / values.length
  const barW = Math.max(3, Math.min(26, slot * 0.7))
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const every = values.length > 14 ? 5 : 1

  const dayLabel = (i) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i)
    return values.length <= 7
      ? d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'narrow' })
      : String(d.getDate())
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={label}>
      {daily > 0 && (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(daily)} y2={y(daily)} className={styles.limit} />
          <text x={W - pad.r} y={y(daily) - 4} textAnchor="end" className={styles.limitText}>{lineLabel}</text>
        </>
      )}
      {values.map((v, i) => {
        const x = pad.l + slot * i + (slot - barW) / 2
        const h = Math.max(v > 0 ? 2 : 0, H - pad.b - y(v))
        return (
          <g key={i}>
            <rect x={x} y={H - pad.b - h} width={barW} height={h} rx="3" className={v > daily && daily > 0 ? styles.barOver : styles.bar} />
            {i % every === 0 && <text x={x + barW / 2} y={H - 6} textAnchor="middle" className={styles.axis}>{dayLabel(i)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// `preloaded` ({ budget, transactions }) skips the fetch (used for UI tests).
export default function ReportPage({ preloaded } = {}) {
  const { user } = useUser()
  const { t, lang } = useTranslation()
  const currency = useCurrency()

  const [state, setState] = useState(preloaded ? { status: 'ready', ...preloaded } : { status: 'loading' })
  const [tab, setTab] = useState('week')
  const [nowTick] = useState(() => Date.now())

  useEffect(() => {
    if (!user || preloaded) return
    let cancelled = false
    fetchReportData(user.uid, new Date(nowTick))
      .then((data) => { if (!cancelled) setState({ status: 'ready', ...data }) })
      .catch((err) => {
        console.error('[report] load failed:', err)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [user, nowTick, preloaded])

  const report = useMemo(() => {
    if (state.status !== 'ready') return null
    return buildReport(state.budget, state.transactions, { kind: tab, now: new Date(nowTick) })
  }, [state, tab, nowTick])

  const m = (n) => `${currency} ${money(n)}`
  const dateFmt = (d) => d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' })
  const catLabel = (id) => { const c = getCategory(id); return `${c.emoji} ${lang === 'ar' ? c.labelAr : c.labelEn}` }

  const insightText = (ins) => {
    const p = { ...ins.params }
    for (const k of ['projected', 'pool', 'over', 'amount']) if (typeof p[k] === 'number') p[k] = m(p[k])
    if (ins.category) p.category = catLabel(ins.category)
    if (p.unit) p.unit = t(`report.unit.${p.unit}`)
    return fillText(t(`report.ins.${ins.key}`), p)
  }

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.title}>{t('report.title')}</h1>
        <p className={styles.subtitle}>{t('report.subtitle')}</p>
      </header>

      {state.status === 'loading' && <p className={styles.note}>{t('report.loading')}</p>}
      {state.status === 'error' && <p className={styles.error} role="alert">{t('report.error')}</p>}

      {report && !report.hasPlan && (
        <div className={styles.card}>
          <p>{t('report.noPlan')}</p>
          <Link href="/onboarding" className={styles.cta}>{t('report.noPlanCta')}</Link>
        </div>
      )}

      {report?.hasPlan && (
        <>
          <div className={styles.tabs} role="tablist">
            {['week', 'period'].map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={`${styles.tab} ${tab === k ? styles.tabOn : ''}`} onClick={() => setTab(k)}>
                {t(`report.${k}`)}
              </button>
            ))}
          </div>
          <p className={styles.range}>{dateFmt(report.startDate)} – {dateFmt(report.endDate)}</p>

          <section className={styles.card} data-rating={report.rating}>
            <div className={styles.ratingRow}>
              <span className={styles.rating}>{t(`report.rating.${report.rating}`)}</span>
              {report.prev.free > 0 && report.cur.count > 0 && (() => {
                const pct = ((report.cur.free - report.prev.free) / report.prev.free) * 100
                return <span className={styles.delta}>{pct >= 0 ? '▲' : '▼'} {Math.abs(Math.round(pct))}% {t('report.vsPrev')}</span>
              })()}
            </div>
            <div className={styles.bigNumber}>{m(report.cur.free)}</div>
            <div className={styles.sub}>{t('report.freeSpent')} · {fillText(t('report.ofAllowance'), { amount: m(report.allowance) })}</div>
            <div className={styles.track} aria-hidden="true">
              <div className={styles.fill} style={{ width: `${Math.min(100, (report.ratio || 0) * 100)}%` }} />
            </div>
            <dl className={styles.facts}>
              <div><dt>{t('report.fixedPaid')}</dt><dd>{m(report.cur.essentialsPaid)}</dd></div>
              <div><dt>{t('report.income')}</dt><dd>{m(report.cur.income)}</dd></div>
              {report.worst && <div><dt>{t('report.worstDay')}</dt><dd>{m(report.worst.amount)} · {dateFmt(report.worst.date)}</dd></div>}
              {report.projection && <div><dt>{t('report.projection')}</dt><dd>{fillText(t('report.projectedOf'), { projected: m(report.projection.projected), pool: m(report.projection.pool) })}</dd></div>}
            </dl>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>{t('report.chartTitle')}</h2>
            <DayChart
              values={report.cur.byDay}
              daily={report.baseDaily}
              startDate={report.startDate}
              lang={lang}
              label={t('report.chartTitle')}
              lineLabel={t('report.dailyLine')}
            />
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>{t('report.categories')}</h2>
            {report.topCategories.length === 0 && <p className={styles.note}>{t('report.noCategories')}</p>}
            <ul className={styles.cats}>
              {report.topCategories.map((c) => (
                <li key={c.category}>
                  <div className={styles.catRow}>
                    <span>{catLabel(c.category)}</span>
                    <strong>{m(c.amount)}</strong>
                  </div>
                  <div className={styles.track} aria-hidden="true"><div className={styles.fillBlue} style={{ width: `${c.pct}%` }} /></div>
                  {c.before > 0 && Math.abs(c.delta) >= 1 && (
                    <span className={c.delta > 0 ? styles.up : styles.down}>
                      {c.delta > 0 ? '▲' : '▼'} {m(Math.abs(c.delta))} {c.delta > 0 ? t('report.up') : t('report.down')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card}>
            <h2 className={styles.h2}>{t('report.insights')}</h2>
            <ul className={styles.insights}>
              {report.insights.map((ins) => <li key={ins.key}>{insightText(ins)}</li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
