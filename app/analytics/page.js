'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { subscribeToTransactions, deleteTransaction } from '@/services/transactionsService'
import { subscribeToWallets, updateWallet } from '@/services/walletService'
import { subscribeToBudget, refundFromBudget } from '@/services/budgetService'
import { getCategory } from '@/lib/categories'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import Reveal from '@/components/features/Reveal'
import EditTransactionModal from '@/components/features/EditTransactionModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import styles from './page.module.css'
import { useTranslation } from '@/hooks/useTranslation'

const TABS = ['Day', 'Week', 'Month', 'Compare']
const TAB_ICONS = { Day: '📅', Week: '📆', Month: '📊', Compare: '⚖️' }

function padZero(num) {
  return String(num).padStart(2, '0')
}

function formatDateLocal(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`
}

function formatMonthLocal(date) {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}`
}

function parseDateInput(str) {
  if (!str) return new Date()
  const parts = str.split('-').map(Number)
  if (parts.length === 2) {
    return new Date(parts[0], parts[1] - 1, 1)
  }
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2])
  }
  const fallback = new Date(str)
  return isNaN(fallback.getTime()) ? new Date() : fallback
}

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
  d.setMonth(d.getMonth() + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

function formatLabel(date, mode, lang = 'en') {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  if (mode === 'Day') {
    return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (mode === 'Week') {
    const s = startOfWeek(d)
    const e = endOfWeek(d)
    return `${s.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}`
  }
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

function filterTransactions(txns, date, mode) {
  const ts = new Date(date)
  let start, end
  if (mode === 'Day') {
    start = startOfDay(ts)
    end = endOfDay(ts)
  } else if (mode === 'Week') {
    start = startOfWeek(ts)
    end = endOfWeek(ts)
  } else {
    start = startOfMonth(ts)
    end = endOfMonth(ts)
  }
  return txns.filter((t) => {
    const tDate = t.createdAt ? new Date(t.createdAt) : null
    if (!tDate || isNaN(tDate.getTime())) return false
    return tDate >= start && tDate <= end
  })
}

function calcStats(txns) {
  const expenses = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const transfers = txns.filter((t) => t.type === 'transfer').reduce((s, t) => s + Number(t.amount || 0), 0)
  const net = income - expenses
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : 0

  const catMap = {}
  txns.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = t.category || 'Other'
    if (!catMap[cat]) {
      catMap[cat] = { amount: 0, count: 0 }
    }
    catMap[cat].amount += Number(t.amount || 0)
    catMap[cat].count += 1
  })

  const categories = Object.entries(catMap)
    .map(([key, data]) => {
      const cat = getCategory(key)
      const pct = expenses > 0 ? Math.round((data.amount / expenses) * 100) : 0
      const avg = data.count > 0 ? Math.round(data.amount / data.count) : 0
      return {
        id: key,
        amount: data.amount,
        count: data.count,
        avg,
        percentage: pct,
        emoji: cat.emoji || '📁',
        color: cat.color || '#94A3B8',
        labelAr: cat.labelAr || key,
        labelEn: cat.labelEn || key,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  return {
    expenses,
    income,
    transfers,
    net,
    savingsRate,
    count: txns.length,
    expenseCount: txns.filter((t) => t.type === 'expense').length,
    incomeCount: txns.filter((t) => t.type === 'income').length,
    categories,
  }
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { user } = useUser()
  const { t, lang, isAr } = useTranslation()
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [budgetCategories, setBudgetCategories] = useState([])
  const [tab, setTab] = useState('Month')
  const [date1, setDate1] = useState(new Date())
  const [date2, setDate2] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d
  })
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [showAIPopup, setShowAIPopup] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    const unsub1 = subscribeToTransactions(user.uid, setTransactions)
    const unsub2 = subscribeToWallets(user.uid, setWallets)
    const unsub3 = subscribeToBudget(user.uid, (data) => {
      setBudgetCategories(data?.categories || [])
    })
    return () => {
      unsub1()
      unsub2()
      if (typeof unsub3 === 'function') unsub3()
    }
  }, [user])

  const stats1 = useMemo(() => filterTransactions(transactions, date1, tab === 'Compare' ? 'Month' : tab), [transactions, date1, tab])
  const stats2 = useMemo(() => {
    if (tab !== 'Compare') return []
    return filterTransactions(transactions, date2, 'Month')
  }, [transactions, date2, tab])

  const s1 = useMemo(() => calcStats(stats1), [stats1])
  const s2 = useMemo(() => calcStats(stats2), [stats2])

  const handleDateChange = (val, setter) => {
    setter(parseDateInput(val))
  }

  const handleCompare = () => {
    if (s1.count === 0 && s2.count === 0) return
    setShowAIPopup(true)
  }

  const handleAIAccept = () => {
    const msg = encodeURIComponent(
      `I need help saving money. I'm comparing my spending across two periods.\n\n` +
      `Period 1 (${formatLabel(date1, 'Month', 'en')}):\n` +
      `- Total Spent: EGP ${s1.expenses}\n` +
      `- Total Income: EGP ${s1.income}\n` +
      `- Net: EGP ${s1.net}\n` +
      `- Top Categories: ${s1.categories.slice(0, 3).map((c) => `${c.emoji} ${c.id}: EGP ${c.amount}`).join(', ')}\n\n` +
      `Period 2 (${formatLabel(date2, 'Month', 'en')}):\n` +
      `- Total Spent: EGP ${s2.expenses}\n` +
      `- Total Income: EGP ${s2.income}\n` +
      `- Net: EGP ${s2.net}\n` +
      `- Top Categories: ${s2.categories.slice(0, 3).map((c) => `${c.emoji} ${c.id}: EGP ${c.amount}`).join(', ')}\n\n` +
      `Difference: Spent ${s2.expenses - s1.expenses >= 0 ? 'increased' : 'decreased'} by EGP ${Math.abs(s2.expenses - s1.expenses)}, ` +
      `Income ${s2.income - s1.income >= 0 ? 'increased' : 'decreased'} by EGP ${Math.abs(s2.income - s1.income)}.\n\n` +
      `Please suggest a practical savings plan to help me reduce expenses and increase savings based on this comparison.`
    )
    router.push(`/ai?msg=${msg}`)
  }

  const diffSpent = s2.expenses - s1.expenses
  const diffIncome = s2.income - s1.income
  const diffNet = s2.net - s1.net

  const DONUT_RADIUS = 44
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

  const donutSegments = useMemo(() => {
    if (!s1.expenses || s1.categories.length === 0) return []
    let cumulative = 0
    return s1.categories.map((c) => {
      const pct = c.amount / s1.expenses
      const dashLen = pct * DONUT_CIRCUMFERENCE
      const offset = -cumulative * DONUT_CIRCUMFERENCE
      cumulative += pct
      return {
        ...c,
        dashLen,
        offset,
      }
    })
  }, [s1.expenses, s1.categories, DONUT_CIRCUMFERENCE])

  const barData1 = useMemo(() => {
    if (tab === 'Month') {
      const daysInMonth = new Date(date1.getFullYear(), date1.getMonth() + 1, 0).getDate()
      const days = []
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(date1.getFullYear(), date1.getMonth(), i)
        const dateStr = formatDateLocal(d)
        const amount = stats1
          .filter((t) => t.type === 'expense' && formatDateLocal(t.createdAt) === dateStr)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        days.push({
          label: String(i),
          fullDate: d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }),
          amount,
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
        const dateStr = formatDateLocal(d)
        const label = d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short' })
        const amount = stats1
          .filter((t) => t.type === 'expense' && formatDateLocal(t.createdAt) === dateStr)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0)
        days.push({
          label,
          fullDate: d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' }),
          amount,
        })
      }
      return days
    }
    return []
  }, [tab, date1, stats1, isAr])

  const handleExportCSV = () => {
    if (stats1.length === 0) return
    const headers = ['Date', 'Type', 'Category', 'Merchant/Description', 'Amount', 'Currency', 'Wallet', 'Notes']
    const rows = stats1.map((tx) => [
      formatDateLocal(tx.createdAt),
      tx.type || 'expense',
      `"${(tx.category || '').replace(/"/g, '""')}"`,
      `"${(tx.merchant || '').replace(/"/g, '""')}"`,
      Number(tx.amount || 0),
      tx.currency || 'EGP',
      `"${(tx.walletName || '').replace(/"/g, '""')}"`,
      `"${(tx.reason || '').replace(/"/g, '""')}"`,
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `flowin-report-${tab.toLowerCase()}-${formatDateLocal(date1)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDelete = async () => {
    if (!user || !deletingTx) return
    setDeleteLoading(true)
    try {
      const amt = Number(deletingTx.amount || 0)
      const txWalletId = deletingTx.walletId || wallets.find((x) => {
        if (deletingTx.walletName && x.name?.toLowerCase() === deletingTx.walletName?.toLowerCase()) return true
        if (deletingTx.merchant && deletingTx.merchant.toLowerCase() === `initial balance - ${x.name?.toLowerCase()}`) return true
        return false
      })?.id || null
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
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleteLoading(false)
    }
  }

  const renderSummaryCards = (s) => {
    const cards = [
      {
        label: t('analytics.totalSpent'),
        numValue: s.expenses,
        prefix: 'EGP ',
        color: '#EF4444',
        icon: '💸',
        sub: `${s.expenseCount || 0} ${t('analytics.txCount')}`,
      },
      {
        label: t('analytics.totalIncome'),
        numValue: s.income,
        prefix: 'EGP ',
        color: '#22C55E',
        icon: '💰',
        sub: `${s.incomeCount || 0} ${t('analytics.txCount')}`,
      },
      {
        label: t('analytics.net'),
        numValue: Math.abs(s.net),
        prefix: s.net >= 0 ? '+EGP ' : '-EGP ',
        color: s.net >= 0 ? '#22C55E' : '#EF4444',
        icon: s.net >= 0 ? '📈' : '📉',
        sub: s.income > 0 ? `${t('analytics.savingsRate')}: ${s.savingsRate}%` : null,
      },
      {
        label: t('analytics.totalTransactions'),
        numValue: s.count,
        prefix: '',
        color: '#F59E0B',
        icon: '📋',
        sub: `${s.categories.length} ${t('analytics.category')}`,
      },
    ]

    return cards.map((card, i) => (
      <div key={i} className={styles.summaryCard} style={{ '--accent': card.color }}>
        <div className={styles.cardTop}>
          <span className={styles.summaryLabel}>{card.label}</span>
          <div className={styles.cardIcon} style={{ background: `${card.color}18`, color: card.color }}>
            {card.icon}
          </div>
        </div>
        <span className={styles.summaryValue} style={{ color: card.color }}>
          {card.prefix}<AnimatedNumber value={card.numValue} decimals={0} />
        </span>
        {card.sub && <span className={styles.subText}>{card.sub}</span>}
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

        {stats1.length > 0 && (
          <div className={styles.headerActions}>
            <button className={styles.actionButton} onClick={handleExportCSV} title={t('analytics.exportCsv')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{t('analytics.exportCsv')}</span>
            </button>
            <button className={styles.actionButtonOutline} onClick={handlePrint} title={t('analytics.printReport')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>{t('analytics.printReport')}</span>
            </button>
          </div>
        )}
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
            <span className={styles.dateLabel}>{tab === 'Compare' ? t('analytics.period1') : t('analytics.period')}</span>
            <input
              type={tab === 'Day' ? 'date' : 'month'}
              className={styles.dateInput}
              value={tab === 'Month' || tab === 'Compare' ? formatMonthLocal(date1) : formatDateLocal(date1)}
              onChange={(e) => handleDateChange(e.target.value, setDate1)}
            />
            <span className={styles.subText}>{formatLabel(date1, tab === 'Compare' ? 'Month' : tab, lang)}</span>
          </div>

          {tab === 'Compare' && (
            <div className={styles.dateGroup}>
              <span className={styles.dateLabel}>{t('analytics.period2')}</span>
              <input
                type="month"
                className={styles.dateInput}
                value={formatMonthLocal(date2)}
                onChange={(e) => handleDateChange(e.target.value, setDate2)}
              />
              <span className={styles.subText}>{formatLabel(date2, 'Month', lang)}</span>
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
                  <span className={styles.summaryLabel}>{t('analytics.period1')}</span>
                  <div className={styles.cardIcon} style={{ background: '#4DA3FF18', color: '#4DA3FF' }}>📆</div>
                </div>
                <span className={styles.summaryValue}>EGP <AnimatedNumber value={s1.expenses} decimals={0} /></span>
                <span className={styles.subText}>{s1.count} {t('analytics.totalTransactions')} ({formatLabel(date1, 'Month', lang)})</span>
              </div>

              <div className={styles.summaryCard} style={{ borderTopColor: '#8B5CF6' }}>
                <div className={styles.cardTop}>
                  <span className={styles.summaryLabel}>{t('analytics.period2')}</span>
                  <div className={styles.cardIcon} style={{ background: '#8B5CF618', color: '#8B5CF6' }}>📆</div>
                </div>
                <span className={styles.summaryValue}>EGP <AnimatedNumber value={s2.expenses} decimals={0} /></span>
                <span className={styles.subText}>{s2.count} {t('analytics.totalTransactions')} ({formatLabel(date2, 'Month', lang)})</span>
              </div>

              <div className={styles.summaryCard} style={{ borderTopColor: diffSpent <= 0 ? '#22C55E' : '#EF4444' }}>
                <div className={styles.cardTop}>
                  <span className={styles.summaryLabel}>{t('analytics.spendingChange')}</span>
                  <div className={styles.cardIcon} style={{ background: `${diffSpent <= 0 ? '#22C55E' : '#EF4444'}18`, color: diffSpent <= 0 ? '#22C55E' : '#EF4444' }}>
                    {diffSpent <= 0 ? '📉' : '📈'}
                  </div>
                </div>
                <span className={`${styles.summaryValue} ${diffSpent <= 0 ? styles.changeUp : styles.changeDown}`}>
                  {diffSpent <= 0 ? '-' : '+'}EGP <AnimatedNumber value={Math.abs(diffSpent)} decimals={0} />
                </span>
                <span className={styles.subText}>
                  {s1.expenses > 0 ? `${Math.round((diffSpent / s1.expenses) * 100)}%` : diffSpent !== 0 ? '+100%' : '0%'}
                </span>
              </div>

              <div className={styles.summaryCard} style={{ borderTopColor: diffNet >= 0 ? '#22C55E' : '#EF4444' }}>
                <div className={styles.cardTop}>
                  <span className={styles.summaryLabel}>{t('analytics.netChange')}</span>
                  <div className={styles.cardIcon} style={{ background: `${diffNet >= 0 ? '#22C55E' : '#EF4444'}18`, color: diffNet >= 0 ? '#22C55E' : '#EF4444' }}>
                    {diffNet >= 0 ? '📈' : '📉'}
                  </div>
                </div>
                <span className={`${styles.summaryValue} ${diffNet >= 0 ? styles.changeUp : styles.changeDown}`}>
                  {diffNet >= 0 ? '+' : ''}EGP <AnimatedNumber value={diffNet} decimals={0} />
                </span>
                <span className={styles.subText}>
                  {t('analytics.totalIncome')}: {diffIncome >= 0 ? '+' : ''}EGP {new Intl.NumberFormat('en-US').format(diffIncome)}
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className={styles.chartGrid}>
              <div className={`${styles.chartCard} ${styles.chartWide}`}>
                <div className={styles.chartHeader}>
                  <h3 className={styles.chartTitle}>{t('analytics.categoryComparison')}</h3>
                  <div className={styles.compareLegends}>
                    <span className={styles.legendIndicator}><span style={{ background: '#4DA3FF' }} /> {t('analytics.period1')}</span>
                    <span className={styles.legendIndicator}><span style={{ background: '#8B5CF6' }} /> {t('analytics.period2')}</span>
                  </div>
                </div>
                <div className={styles.comparison}>
                  {[...new Set([...s1.categories, ...s2.categories].map((c) => c.id))].slice(0, 8).map((catId) => {
                    const c1 = s1.categories.find((c) => c.id === catId)
                    const c2 = s2.categories.find((c) => c.id === catId)
                    const cat = getCategory(catId)
                    const maxVal = Math.max(c1?.amount || 0, c2?.amount || 0) || 1
                    return (
                      <div key={catId} className={styles.compItem}>
                        <span className={styles.compLabel}>{cat.emoji} {isAr ? (cat.labelAr || catId) : (cat.labelEn || catId)}</span>
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
                  <strong>{t('analytics.aiSavingsTitle')}</strong>
                  <p>{t('analytics.aiSavingsSubtitle')}</p>
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
                    <h3 className={styles.chartTitle}>{t('analytics.topCategories')}</h3>
                    <span className={styles.chartTotal}>
                      {t('analytics.totalSpent')}: EGP {new Intl.NumberFormat('en-US').format(s1.expenses)}
                    </span>
                  </div>
                  <div className={styles.chartArea}>
                    <div className={styles.pieWrap}>
                      <svg viewBox="0 0 120 120" className={styles.donutSvg}>
                        <circle cx="60" cy="60" r={DONUT_RADIUS} fill="none" stroke="var(--hover-bg)" strokeWidth="18" />
                        {donutSegments.map((seg) => (
                          <circle
                            key={seg.id}
                            cx="60"
                            cy="60"
                            r={DONUT_RADIUS}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="18"
                            strokeDasharray={`${seg.dashLen} ${DONUT_CIRCUMFERENCE}`}
                            strokeDashoffset={seg.offset}
                            transform="rotate(-90 60 60)"
                            className={styles.donutSegment}
                            onMouseEnter={() => setHoveredCategory(seg)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </svg>
                      <div className={styles.pieCenter}>
                        {hoveredCategory ? (
                          <div className={styles.pieCenterContent}>
                            <span className={styles.pieCenterEmoji}>{hoveredCategory.emoji}</span>
                            <span className={styles.pieCenterPct}>{hoveredCategory.percentage}%</span>
                          </div>
                        ) : (
                          <div className={styles.pieCenterContent}>
                            <span className={styles.pieCenterValue}>EGP {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(s1.expenses)}</span>
                            <span className={styles.pieCenterLabel}>{t('analytics.totalSpent')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.legend}>
                      {s1.categories.slice(0, 6).map((c) => (
                        <div
                          key={c.id}
                          className={`${styles.legendItem} ${hoveredCategory?.id === c.id ? styles.legendItemActive : ''}`}
                          onMouseEnter={() => setHoveredCategory(c)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          <div className={styles.legendDot} style={{ background: c.color }} />
                          <span className={styles.legendLabel}>
                            {c.emoji} {isAr ? (c.labelAr || c.id) : (c.labelEn || c.id)}
                          </span>
                          <span className={styles.legendAmount}>EGP {new Intl.NumberFormat('en-US').format(c.amount)}</span>
                          <span className={styles.legendPct}>{c.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            )}

            {(tab === 'Month' || tab === 'Week') && (
              <Reveal delay={200}>
                <div className={`${styles.chartCard} ${s1.categories.length === 0 ? styles.chartWide : ''}`}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      {tab === 'Month' ? t('analytics.monthlySpending') : t('analytics.weeklySpending')} ({formatLabel(date1, tab, lang)})
                    </h3>
                    <span className={styles.chartTotal}>
                      {s1.expenses > 0 ? `EGP ${new Intl.NumberFormat('en-US').format(s1.expenses)}` : ''}
                    </span>
                  </div>
                  <div className={styles.barChart}>
                    {barData1.filter((d) => d.amount > 0).length > 0 ? (
                      barData1.map((d, idx) => {
                        const maxBar = Math.max(...barData1.map((b) => b.amount), 1)
                        const heightPct = Math.max((d.amount / maxBar) * 100, 4)
                        return (
                          <div key={idx} className={styles.barCol}>
                            <div
                              className={styles.bar}
                              style={{
                                height: d.amount > 0 ? `${heightPct}%` : '4px',
                                opacity: d.amount > 0 ? 1 : 0.25,
                                animationDelay: `${idx * 15}ms`,
                              }}
                            >
                              {d.amount > 0 && (
                                <span className={styles.barTooltip}>
                                  <strong>{d.fullDate}</strong>
                                  <span>EGP {new Intl.NumberFormat('en-US').format(d.amount)}</span>
                                </span>
                              )}
                            </div>
                            <span className={styles.barLabel}>{d.label}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className={styles.emptyChart}>{t('analytics.noData')}</div>
                    )}
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Detailed Category Breakdown Table */}
          {s1.categories.length > 0 && (
            <Reveal delay={220}>
              <div className={styles.section}>
                <div className={styles.tableCard}>
                  <div className={styles.listHeader}>
                    <h3 className={styles.listTitle}>{t('analytics.detailedBreakdown')}</h3>
                    <span className={styles.listCount}>{s1.categories.length} {t('analytics.category')}</span>
                  </div>
                  <div className={styles.tableWrapper}>
                    <table className={styles.reportTable}>
                      <thead>
                        <tr>
                          <th>{t('analytics.category')}</th>
                          <th>{t('analytics.txCount')}</th>
                          <th>{t('analytics.avgPerTx')}</th>
                          <th>{t('analytics.amount')}</th>
                          <th>{t('analytics.percentage')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s1.categories.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <div className={styles.tableCatCell}>
                                <span className={styles.tableCatDot} style={{ background: c.color }} />
                                <span className={styles.tableCatEmoji}>{c.emoji}</span>
                                <strong>{isAr ? (c.labelAr || c.id) : (c.labelEn || c.id)}</strong>
                              </div>
                            </td>
                            <td>{c.count}</td>
                            <td>EGP {new Intl.NumberFormat('en-US').format(c.avg)}</td>
                            <td>
                              <strong className={styles.tableAmount}>EGP {new Intl.NumberFormat('en-US').format(c.amount)}</strong>
                            </td>
                            <td>
                              <div className={styles.tableProgressWrap}>
                                <div className={styles.tableProgressBar}>
                                  <div className={styles.tableProgressFill} style={{ width: `${c.percentage}%`, background: c.color }} />
                                </div>
                                <span>{c.percentage}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </Reveal>
          )}

          {stats1.length > 0 && (
            <Reveal delay={250}>
              <div className={styles.section}>
                <div className={styles.transactionList}>
                  <div className={styles.listHeader}>
                    <h3 className={styles.listTitle}>{t('analytics.allTransactions')}</h3>
                    <span className={styles.listCount}>{stats1.length} {t('analytics.total')}</span>
                  </div>
                  {stats1.slice(0, 50).map((tx) => {
                    const cat = getCategory(tx.category)
                    const isIncome = tx.type === 'income'
                    const isTransfer = tx.type === 'transfer'
                    return (
                      <div key={tx.id} className={styles.txItem}>
                        <div className={styles.txAvatar} style={{ background: `${cat.color}20` }}>
                          <span>{cat.emoji}</span>
                        </div>
                        <div className={styles.txInfo}>
                          <span className={styles.txName}>{tx.merchant || tx.category || 'Transaction'}</span>
                          <span className={styles.txMeta}>
                            {cat.emoji} {isAr ? (cat.labelAr || tx.category) : (cat.labelEn || tx.category)}
                            {tx.reason && <span className={styles.txReason}> · {tx.reason}</span>}
                            · {new Date(tx.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                            {tx.walletName ? ` · ${tx.walletName}` : ''}
                          </span>
                        </div>
                        <span className={`${styles.txAmount} ${isIncome ? styles.txPositive : isTransfer ? styles.txNeutral : styles.txNegative}`}>
                          {isIncome ? '+' : isTransfer ? '↔' : '-'}{tx.currency || 'EGP'} {new Intl.NumberFormat('en-US').format(Number(tx.amount || 0))}
                        </span>
                        <div className={styles.txActions}>
                          <button className={`${styles.txActionBtn} ${styles.txEditBtn}`} onClick={() => setEditingTx(tx)} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button className={`${styles.txActionBtn} ${styles.txDeleteBtn}`} onClick={() => setDeletingTx(tx)} title="Delete">
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
              <p className={styles.emptyHint}>{t('analytics.emptyHint')}</p>
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
            <h3 className={styles.aiPopupTitle}>{t('analytics.aiPopupTitle')}</h3>
            <p className={styles.aiPopupText}>{t('analytics.aiPopupText')}</p>
            <div className={styles.aiPopupActions}>
              <button className={styles.aiPopupNo} onClick={() => setShowAIPopup(false)}>
                {t('analytics.aiPopupNo')}
              </button>
              <button className={styles.aiPopupYes} onClick={handleAIAccept}>
                {t('analytics.aiPopupYes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTx && user && (
        <EditTransactionModal
          uid={user.uid}
          transaction={editingTx}
          wallets={wallets}
          budgetCategories={budgetCategories}
          onClose={() => setEditingTx(null)}
        />
      )}

      <ConfirmDialog
        open={!!deletingTx}
        title={t('analytics.deleteTxTitle')}
        message={deletingTx ? `${t('analytics.deleteTxMsg')} (${deletingTx.merchant || deletingTx.category} - EGP ${deletingTx.amount})` : ''}
        confirmLabel={deleteLoading ? t('analytics.deleteLoading') : t('analytics.delete')}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  )
}
