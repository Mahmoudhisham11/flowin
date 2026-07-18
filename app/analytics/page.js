'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { subscribeToTransactions } from '@/services/transactionsService'
import { getCategory } from '@/lib/categories'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import Reveal from '@/components/features/Reveal'
import EditTransactionModal from '@/components/features/EditTransactionModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { deleteTransaction } from '@/services/transactionsService'
import { refundFromBudget } from '@/services/budgetService'
import { updateWallet } from '@/services/walletService'
import { subscribeToWallets } from '@/services/walletService'
import styles from './page.module.css'
import { useTranslation } from '@/hooks/useTranslation'

const TABS = ['Day', 'Week', 'Month', 'Compare']
const TAB_ICONS = { Day: '📅', Week: '📆', Month: '📊', Compare: '⚖️' }

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date) {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeek(date) {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfMonth(date) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function formatLabel(date, mode) {
  if (mode === 'Day') return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (mode === 'Week') return `${startOfWeek(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function filterTransactions(txns, date, mode) {
  const ts = new Date(date)
  let start, end
  if (mode === 'Day') { start = startOfDay(ts); end = endOfDay(ts) }
  else if (mode === 'Week') { start = startOfWeek(ts); end = endOfWeek(ts) }
  else { start = startOfMonth(ts); end = endOfMonth(ts) }
  return txns.filter((t) => {
    const tDate = new Date(t.createdAt)
    return tDate >= start && tDate <= end
  })
}

function calcStats(txns) {
  const expenses = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const transfers = txns.filter((t) => t.type === 'transfer').reduce((s, t) => s + Number(t.amount || 0), 0)
  const net = income - expenses
  const catMap = {}
  txns.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = t.category || 'Other'
    catMap[cat] = (catMap[cat] || 0) + Number(t.amount || 0)
  })
  const categories = Object.entries(catMap)
    .map(([key, amount]) => {
      const cat = getCategory(key)
      return { id: key, amount, emoji: cat.emoji, color: cat.color }
    })
    .sort((a, b) => b.amount - a.amount)
  return { expenses, income, transfers, net, count: txns.length, categories }
}

export default function AnalyticsPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [tab, setTab] = useState('Month')
  const [date1, setDate1] = useState(new Date())
  const [date2, setDate2] = useState(new Date())
  const [showAIPopup, setShowAIPopup] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    const unsub1 = subscribeToTransactions(user.uid, setTransactions)
    const unsub2 = subscribeToWallets(user.uid, setWallets)
    return () => { unsub1(); unsub2() }
  }, [user])

  const stats1 = useMemo(() => filterTransactions(transactions, date1, tab === 'Compare' ? 'Month' : tab), [transactions, date1, tab])
  const stats2 = useMemo(() => {
    if (tab !== 'Compare') return []
    return filterTransactions(transactions, date2, 'Month')
  }, [transactions, date2, tab])

  const s1 = useMemo(() => calcStats(stats1), [stats1])
  const s2 = useMemo(() => calcStats(stats2), [stats2])

  const handleDateChange = (val, setter) => {
    const d = new Date(val)
    setter(d)
  }

  const handleCompare = () => {
    if (s1.count === 0 && s2.count === 0) return
    setShowAIPopup(true)
  }

  const handleAIAccept = () => {
    const msg = encodeURIComponent(
      `I need help saving money. I'm comparing my spending across two periods.\n\n` +
      `Period 1 (${formatLabel(date1, 'Month')}):\n` +
      `- Total Spent: EGP ${s1.expenses}\n` +
      `- Total Income: EGP ${s1.income}\n` +
      `- Net: EGP ${s1.net}\n` +
      `- Top Categories: ${s1.categories.slice(0, 3).map((c) => `${c.emoji} ${c.id}: EGP ${c.amount}`).join(', ')}\n\n` +
      `Period 2 (${formatLabel(date2, 'Month')}):\n` +
      `- Total Spent: EGP ${s2.expenses}\n` +
      `- Total Income: EGP ${s2.income}\n` +
      `- Net: EGP ${s2.net}\n` +
      `- Top Categories: ${s2.categories.slice(0, 3).map((c) => `${c.emoji} ${c.id}: EGP ${c.amount}`).join(', ')}\n\n` +
      `Difference: Spent ${s2.expenses - s1.expenses >= 0 ? 'increased' : 'decreased'} by EGP ${Math.abs(s2.expenses - s1.expenses)}, ` +
      `Income ${s2.income - s1.income >= 0 ? 'increased' : 'decreased'} by EGP ${Math.abs(s2.income - s1.income)}.\n\n` +
      `Please suggest a practical savings plan to help me reduce expenses and increase savings based on this comparison.`
    )
    window.location.href = `/ai?msg=${msg}`
  }

  const diffSpent = s2.expenses - s1.expenses
  const diffIncome = s2.income - s1.income
  const diffNet = s2.net - s1.net

  const totalCatSpent1 = s1.categories.reduce((s, c) => s + c.amount, 0)
  const DONUT_RADIUS = 48
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

  const barData1 = useMemo(() => {
    if (tab === 'Month') {
      const daysInMonth = new Date(date1.getFullYear(), date1.getMonth() + 1, 0).getDate()
      const days = []
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(date1.getFullYear(), date1.getMonth(), i)
        days.push({
          label: String(i),
          amount: stats1.filter((t) => {
            const td = new Date(t.createdAt)
            return td.getDate() === i && t.type === 'expense'
          }).reduce((s, t) => s + Number(t.amount || 0), 0),
        })
      }
      return days
    }
    if (tab === 'Week') {
      const days = []
      const weekStart = startOfWeek(date1)
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        const label = d.toLocaleDateString('en-US', { weekday: 'short' })
        days.push({
          label,
          amount: stats1.filter((t) => {
            const td = new Date(t.createdAt)
            return formatDate(td) === formatDate(d) && t.type === 'expense'
          }).reduce((s, t) => s + Number(t.amount || 0), 0),
        })
      }
      return days
    }
    return []
  }, [tab, date1, stats1])

  const handleDelete = async () => {
    if (!user || !deletingTx) return
    setDeleteLoading(true)
    try {
      const amt = Number(deletingTx.amount || 0)
      const txWalletId = deletingTx.walletId
      const txType = deletingTx.type
      const txCategory = deletingTx.category
      await deleteTransaction(user.uid, deletingTx.id)
      if (txType === 'expense' && txCategory) {
        refundFromBudget(user.uid, txCategory, amt).catch((err) => console.error('refundFromBudget error:', err))
      }
      if (txWalletId) {
        const w = wallets.find((x) => x.id === txWalletId)
        if (w) {
          const reverse = txType === 'expense' ? amt : -amt
          await updateWallet(user.uid, txWalletId, { balance: Number(w.balance || 0) + reverse })
        }
      }
      setDeletingTx(null)
    } catch { } finally {
      setDeleteLoading(false)
    }
  }

  const renderSummaryCards = (s, colorMap) => {
    const cards = [
      { label: t('analytics.totalSpent'), value: `EGP ${s.expenses}`, color: '#EF4444', icon: '💸', trend: null },
      { label: t('analytics.totalIncome'), value: `EGP ${s.income}`, color: '#22C55E', icon: '💰', trend: null },
      { label: 'Net', value: `${s.net >= 0 ? '+' : '-'}EGP ${Math.abs(s.net)}`, color: s.net >= 0 ? '#22C55E' : '#EF4444', icon: s.net >= 0 ? '📈' : '📉', trend: null },
      { label: 'Transactions', value: String(s.count), color: '#F59E0B', icon: '📋', trend: null },
    ]
    return cards.map((card, i) => (
      <div key={i} className={styles.summaryCard} style={{ '--accent': card.color }}>
        <div className={styles.cardTop}>
          <span className={styles.summaryLabel}>{card.label}</span>
          <div className={styles.cardIcon} style={{ background: `${card.color}18`, color: card.color }}>{card.icon}</div>
        </div>
        <span className={styles.summaryValue} style={{ color: card.color === '#EF4444' ? 'var(--danger)' : card.color === '#22C55E' ? 'var(--success)' : undefined }}>
          <AnimatedNumber value={s.count === card.value ? s.count : undefined} decimals={0} />
          {s.count === card.value ? '' : card.value.replace(/EGP /, '')}
        </span>
        {card.trend !== null && (
          <span className={`${styles.summaryTrend} ${card.trend >= 0 ? '' : ''}`}>{card.trend}</span>
        )}
      </div>
    ))
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>{t('analytics.title')}</h1>
            <p className={styles.subtitle}>{t('analytics.subtitle')}</p>
          </div>
        </div>
      </header>

      <Reveal delay={0}>
      <div className={styles.tabs}>
        {TABS.map((key) => (
          <button key={key} className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => setTab(key)}>
            <span>{TAB_ICONS[key]}</span>
            {{ Day: t('analytics.day'), Week: t('analytics.week'), Month: t('analytics.month'), Compare: t('analytics.compare') }[key]}
          </button>
        ))}
      </div>
      </Reveal>

      <Reveal delay={50}>
      <div className={styles.dateRow}>
        <div className={styles.dateGroup}>
          <span className={styles.dateLabel}>{tab === 'Compare' ? `${t('analytics.period')} 1` : 'Period'}</span>
          <input
            type={tab === 'Day' ? 'date' : 'month'}
            className={styles.dateInput}
            value={tab === 'Month' || tab === 'Compare' ? `${date1.getFullYear()}-${String(date1.getMonth() + 1).padStart(2, '0')}` : formatDate(date1)}
            onChange={(e) => handleDateChange(e.target.value, setDate1)}
          />
          {tab !== 'Day' && tab !== 'Compare' && (
            <span className={styles.subText}>{formatLabel(date1, tab)}</span>
          )}
        </div>
        {tab === 'Compare' && (
          <div className={styles.dateGroup}>
            <span className={styles.dateLabel}>{`${t('analytics.period')} 2`}</span>
            <input
              type="month"
              className={styles.dateInput}
              value={`${date2.getFullYear()}-${String(date2.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => handleDateChange(e.target.value, setDate2)}
            />
            <span className={styles.subText}>{formatLabel(date2, 'Month')}</span>
          </div>
        )}
      </div>
      </Reveal>

      {tab === 'Compare' && (
        <>
          <Reveal delay={100}>
          <div className={styles.cardGrid}>
            <div className={styles.summaryCard} style={{ borderTopColor: '#4DA3FF' }}>
              <div className={styles.cardTop}>
                <span className={styles.summaryLabel}>{`${t('analytics.period')} 1`}</span>
                <div className={styles.cardIcon} style={{ background: '#4DA3FF18', color: '#4DA3FF' }}>📆</div>
              </div>
              <span className={styles.summaryValue}>EGP <AnimatedNumber value={s1.expenses} decimals={0} /></span>
              <span className={styles.subText}>{s1.count} {t('analytics.totalTransactions')}</span>
            </div>
            <div className={styles.summaryCard} style={{ borderTopColor: '#8B5CF6' }}>
              <div className={styles.cardTop}>
                <span className={styles.summaryLabel}>{`${t('analytics.period')} 2`}</span>
                <div className={styles.cardIcon} style={{ background: '#8B5CF618', color: '#8B5CF6' }}>📆</div>
              </div>
              <span className={styles.summaryValue}>EGP <AnimatedNumber value={s2.expenses} decimals={0} /></span>
              <span className={styles.subText}>{s2.count} {t('analytics.totalTransactions')}</span>
            </div>
            <div className={styles.summaryCard} style={{ borderTopColor: diffSpent <= 0 ? '#22C55E' : '#EF4444' }}>
              <div className={styles.cardTop}>
                <span className={styles.summaryLabel}>Spending Change</span>
                <div className={styles.cardIcon} style={{ background: `${diffSpent <= 0 ? '#22C55E' : '#EF4444'}18`, color: diffSpent <= 0 ? '#22C55E' : '#EF4444' }}>{diffSpent <= 0 ? '📉' : '📈'}</div>
              </div>
              <span className={`${styles.summaryValue} ${diffSpent <= 0 ? styles.changeUp : styles.changeDown}`}>
                {diffSpent <= 0 ? '-' : '+'}EGP <AnimatedNumber value={Math.abs(diffSpent)} decimals={0} />
              </span>
              <span className={styles.subText}>{s1.expenses > 0 ? `${Math.round((diffSpent / s1.expenses) * 100)}%` : '—'}</span>
            </div>
            <div className={styles.summaryCard} style={{ borderTopColor: diffNet >= 0 ? '#22C55E' : '#EF4444' }}>
              <div className={styles.cardTop}>
                <span className={styles.summaryLabel}>Net Change</span>
                <div className={styles.cardIcon} style={{ background: `${diffNet >= 0 ? '#22C55E' : '#EF4444'}18`, color: diffNet >= 0 ? '#22C55E' : '#EF4444' }}>{diffNet >= 0 ? '📈' : '📉'}</div>
              </div>
              <span className={`${styles.summaryValue} ${diffNet >= 0 ? styles.changeUp : styles.changeDown}`}>
                {diffNet >= 0 ? '+' : ''}EGP <AnimatedNumber value={diffNet} decimals={0} />
              </span>
              <span className={styles.subText}>{t('common.income')}: {diffIncome >= 0 ? '+' : ''}EGP {new Intl.NumberFormat('en-US').format(Math.abs(diffIncome))}</span>
            </div>
          </div>
          </Reveal>

          <Reveal delay={150}>
          <div className={styles.chartGrid}>
            <div className={`${styles.chartCard} ${styles.chartWide}`}>
              <h3 className={styles.chartTitle}>Category Comparison</h3>
              <div className={styles.comparison}>
                {[...new Set([...s1.categories, ...s2.categories].map((c) => c.id))].slice(0, 6).map((catId) => {
                  const c1 = s1.categories.find((c) => c.id === catId)
                  const c2 = s2.categories.find((c) => c.id === catId)
                  const cat = getCategory(catId)
                  const maxVal = Math.max(c1?.amount || 0, c2?.amount || 0) || 1
                  return (
                    <div key={catId} className={styles.compItem}>
                      <span className={styles.compLabel}>{cat.emoji} {catId}</span>
                      <div className={styles.compBarGroup}>
                        <div className={styles.compBar}>
                          <div className={styles.compBarFill} style={{ width: `${((c1?.amount || 0) / maxVal) * 100}%`, background: '#4DA3FF' }} />
                        </div>
                        <div className={styles.compBar}>
                          <div className={styles.compBarFill} style={{ width: `${((c2?.amount || 0) / maxVal) * 100}%`, background: '#8B5CF6' }} />
                        </div>
                      </div>
                      <div className={styles.compValues}>
                        <span className={styles.compValue} style={{ color: '#4DA3FF' }}>EGP {new Intl.NumberFormat('en-US').format(c1?.amount || 0)}</span>
                        <span className={styles.compValue} style={{ color: '#8B5CF6' }}>EGP {new Intl.NumberFormat('en-US').format(c2?.amount || 0)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          </Reveal>

          <Reveal delay={200}>
          <div className={styles.section}>
          <div className={styles.aiSuggestionBanner} onClick={handleCompare}>
            <div className={styles.aiBannerIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5v2h-4v-2c0-2-2-3-2-5a4 4 0 014-4z" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </div>
            <div className={styles.aiBannerText}>
              <strong>AI Savings Suggestions</strong>
              <p>Get personalized tips to reduce expenses based on this comparison</p>
            </div>
            <button className={styles.aiBannerBtn}>{t('analytics.compareWithAI')}</button>
          </div>
          </div>
          </Reveal>
        </>
      )}

      {tab !== 'Compare' && (
        <>
          <Reveal delay={100}>
          <div className={styles.cardGrid}>
            {renderSummaryCards(s1)}
          </div>
          </Reveal>

          <div className={styles.chartGrid}>
            {s1.categories.length > 0 && (
              <Reveal delay={150}>
              <div className={styles.chartCard}>
                <div className={styles.chartHeader}>
                  <h3 className={styles.chartTitle}>Top Categories</h3>
                  <span className={styles.chartTotal}>{t('analytics.totalSpent')}: EGP {new Intl.NumberFormat('en-US').format(s1.expenses)}</span>
                </div>
                <div className={styles.chartArea}>
                  <div className={styles.pieWrap}>
                    <svg viewBox="0 0 120 120" className={styles.donutSvg}>
                      <circle cx="60" cy="60" r={DONUT_RADIUS} fill="none" stroke="var(--hover-bg)" strokeWidth="22" />
                      {s1.categories.slice(0, 8).map((c, i, arr) => {
                        const total = arr.reduce((s, cx) => s + cx.amount, 0)
                        if (total === 0) return null
                        const cumulativeBefore = arr.slice(0, i).reduce((s, cx) => s + cx.amount, 0) / total
                        const pct = c.amount / total
                        const dashLen = pct * DONUT_CIRCUMFERENCE
                        const offset = DONUT_CIRCUMFERENCE * (1 - cumulativeBefore)
                        return (
                          <circle
                            key={c.id}
                            cx="60" cy="60" r={DONUT_RADIUS}
                            fill="none"
                            stroke={c.color}
                            strokeWidth="22"
                            strokeDasharray={`${dashLen} ${DONUT_CIRCUMFERENCE}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            transform="rotate(-90 60 60)"
                            className={styles.donutSegment}
                          />
                        )
                      })}
                    </svg>
                    <div className={styles.pieCenter}>
                      {totalCatSpent1 > 0 ? Math.round((s1.expenses / totalCatSpent1) * 100) : 0}%
                    </div>
                  </div>
                  <div className={styles.legend}>
                    {s1.categories.slice(0, 5).map((c) => (
                      <div key={c.id} className={styles.legendItem}>
                        <div className={styles.legendDot} style={{ background: c.color }} />
                        <span className={styles.legendLabel}>{c.emoji} {c.id}</span>
                        <span className={styles.legendAmount}>EGP {new Intl.NumberFormat('en-US').format(c.amount)}</span>
                        <span className={styles.legendPct}>{totalCatSpent1 > 0 ? Math.round((c.amount / totalCatSpent1) * 100) : 0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </Reveal>
            )}

            {(tab === 'Month' || tab === 'Week') && (
              <Reveal delay={200}>
              <div className={`${styles.chartCard} ${styles.chartWide}`}>
                <div className={styles.chartHeader}>
                  <h3 className={styles.chartTitle}>
                    {tab === 'Month' ? 'Daily Spending' : 'Daily Spending'} ({formatLabel(date1, tab)})
                  </h3>
                  <span className={styles.chartTotal}>{s1.expenses > 0 ? `EGP ${new Intl.NumberFormat('en-US').format(s1.expenses)}` : ''}</span>
                </div>
                <div className={styles.barChart}>
                  {barData1.filter((d) => d.amount > 0).length > 0 ? barData1.map((d, idx) => {
                    const maxBar = Math.max(...barData1.map((b) => b.amount), 1)
                    return (
                      <div key={d.label} className={styles.barCol}>
                        <div
                          className={styles.bar}
                          style={{
                            height: `${(d.amount / maxBar) * 100}%`,
                            animationDelay: `${idx * 20}ms`,
                          }}
                        >
                          <span className={styles.barTooltip}>EGP {new Intl.NumberFormat('en-US').format(d.amount)}</span>
                        </div>
                        <span className={styles.barLabel}>{d.label}</span>
                      </div>
                    )
                  }) : (
                    <div className={styles.emptyChart}>{t('analytics.noData')}</div>
                  )}
                </div>
              </div>
              </Reveal>
            )}
          </div>

          {stats1.length > 0 && (
            <Reveal delay={250}>
            <div className={styles.section}>
            <div className={styles.transactionList}>
              <div className={styles.listHeader}>
                <h3 className={styles.listTitle}>{t('analytics.totalTransactions')}</h3>
                <span className={styles.listCount}>{stats1.length} total</span>
              </div>
              {stats1.slice(0, 50).map((tx) => {
                const cat = getCategory(tx.category)
                return (
                  <div key={tx.id} className={styles.txItem}>
                    <div className={styles.txAvatar} style={{ background: `${cat.color}20` }}>
                      <span>{cat.emoji}</span>
                    </div>
                    <div className={styles.txInfo}>
                      <span className={styles.txName}>{tx.merchant || tx.category || 'Transaction'}</span>
                      <span className={styles.txMeta}>
                        {cat.emoji} {tx.category} · {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {tx.walletName ? ` · ${tx.walletName}` : ''}
                      </span>
                    </div>
                    <span className={`${styles.txAmount} ${tx.type === 'income' ? styles.txPositive : tx.type === 'transfer' ? styles.txNeutral : styles.txNegative}`}>
                      {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '↔' : '-'}{tx.currency || 'EGP'} {new Intl.NumberFormat('en-US').format(Number(tx.amount))}
                    </span>
                    <div className={styles.txActions}>
                      <button className={`${styles.txActionBtn} ${styles.txEditBtn}`} onClick={() => setEditingTx(tx)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button className={`${styles.txActionBtn} ${styles.txDeleteBtn}`} onClick={() => setDeletingTx(tx)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            </div>
            </Reveal>
          )}

          {s1.count === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className={styles.emptyText}>{t('analytics.noData')}</p>
              <p className={styles.emptyHint}>Try selecting a different date range</p>
            </div>
          )}
        </>
      )}

      {showAIPopup && (
        <div className={styles.overlay} onClick={() => setShowAIPopup(false)}>
          <div className={styles.aiPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.aiPopupIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 014 4c0 2-2 3-2 5v2h-4v-2c0-2-2-3-2-5a4 4 0 014-4z" />
                <line x1="12" y1="17" x2="12" y2="22" />
                <line x1="9" y1="22" x2="15" y2="22" />
              </svg>
            </div>
            <h3 className={styles.aiPopupTitle}>AI Savings Suggestions</h3>
            <p className={styles.aiPopupText}>
              Based on this comparison, I can analyze your spending patterns and suggest
              a personalized savings plan to help you reduce expenses and increase your savings.
              Would you like to try it?
            </p>
            <div className={styles.aiPopupActions}>
              <button className={styles.aiPopupNo} onClick={() => setShowAIPopup(false)}>No, thanks</button>
              <button className={styles.aiPopupYes} onClick={handleAIAccept}>Yes, help me save!</button>
            </div>
          </div>
        </div>
      )}

      {editingTx && user && (
        <EditTransactionModal
          uid={user.uid}
          transaction={editingTx}
          wallets={wallets}
          onClose={() => setEditingTx(null)}
        />
      )}

      <ConfirmDialog
        open={!!deletingTx}
        title="Delete Transaction"
        message={deletingTx ? `Delete this ${deletingTx.type} of EGP ${deletingTx.amount}? Wallet balance will be adjusted.` : ''}
        confirmLabel={deleteLoading ? 'Deleting...' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  )
}
