'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useAppActions } from '@/contexts/AppActionsContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSubscription } from '@/hooks/useSubscription'
import { PlusIcon, TransferIcon } from '@/components/Icons'
import { subscribeToTransactions } from '@/services/transactionsService'
import { subscribeToWallets, WALLET_TYPES } from '@/services/walletService'
import { subscribeToBudget } from '@/services/budgetService'
import { getCategory } from '@/lib/categories'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { computeToday } from '@/lib/planEngine'
import { walletsTotal } from '@/lib/walletTotal'
import Link from 'next/link'
import TodayCard from '@/components/features/TodayCard'
import FixedDueCard from '@/components/features/FixedDueCard'
import AddWalletModal from '@/components/features/AddWalletModal'
import TransferMoneyModal from '@/components/features/TransferMoneyModal'
import EditTransactionModal from '@/components/features/EditTransactionModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import Reveal from '@/components/features/Reveal'
import VoiceButton from '@/components/voice/VoiceButton'
import styles from './page.module.css'
import { useTranslation } from '@/hooks/useTranslation'
import { useCurrency } from '@/hooks/useCurrency'

export default function Home() {
  const currency = useCurrency()
  const { user, userData, logout } = useUser()
  const { theme, setTheme } = useTheme()
  const { plan } = useSubscription()
  const [showBalance, setShowBalance] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [budgetData, setBudgetData] = useState(null)
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [editingWallet, setEditingWallet] = useState(null)
  const [editingTx, setEditingTx] = useState(null)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeWalletIdx, setActiveWalletIdx] = useState(0)
  const [budgetCategories, setBudgetCategories] = useState([])
  const swiperRef = useRef(null)
  const avatarMenuRef = useRef(null)
  const { t } = useTranslation()
  const { openModal } = useAppActions()

  useEffect(() => {
    const handleClick = (e) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setShowAvatarMenu(false)
      }
    }
    if (showAvatarMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvatarMenu])

  useEffect(() => {
    if (!user) return
    const unsubTx = subscribeToTransactions(user.uid, setTransactions)
    const unsubWallets = subscribeToWallets(user.uid, setWallets)
    const unsubBudget = subscribeToBudget(user.uid, (data) => {
      setBudgetData(data)
      setBudgetCategories(data?.essentialCategories || [])
    })
    return () => {
      unsubTx()
      unsubWallets()
      if (typeof unsubBudget === 'function') unsubBudget()
    }
  }, [user])

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  // Re-evaluate "today" every minute so the amount rolls over at midnight without a reload.
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [paydayDismissed, setPaydayDismissed] = useState(() => {
    try { return localStorage.getItem('flowin-payday-dismissed') || '' } catch { return '' }
  })

  const today = useMemo(
    () => computeToday(budgetData, transactions, new Date(nowTick), undefined, { walletsTotal: walletsTotal(wallets) }),
    [budgetData, transactions, nowTick, wallets]
  )

  // Payday: the first days of a new pay period with no income recorded yet.
  const showPayday = useMemo(() => {
    if (!today?.hasPlan || today.dayIndex > 2 || paydayDismissed === today.period.startStr) return false
    const start = today.period.start.getTime()
    return !transactions.some((tx) => tx.type === 'income' && tx.createdAt && new Date(tx.createdAt).getTime() >= start)
  }, [today, transactions, paydayDismissed])

  const dismissPayday = () => {
    const key = today?.period?.startStr || ''
    try { localStorage.setItem('flowin-payday-dismissed', key) } catch {}
    setPaydayDismissed(key)
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const recent = transactions.filter((t) => {
    const td = new Date(t.createdAt)
    return td >= todayStart
  }).slice(0, 10)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.userInfo}>
          <div className={styles.avatarWrap} ref={avatarMenuRef}>
            <button
              className={styles.avatarCircle}
              onClick={() => setShowAvatarMenu((prev) => !prev)}
              title={`${theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'} mode`}
            >
              {(userData?.name || userData?.email || 'U').slice(0, 2).toUpperCase()}
            </button>
            {showAvatarMenu && (
              <div className={styles.avatarDropdown}>
                <button className={styles.dropdownItem} onClick={() => { setTheme('light'); setShowAvatarMenu(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                  <span>{t('money.light')}</span>
                  {theme === 'light' && <span className={styles.dropdownCheck}>✓</span>}
                </button>
                <button className={styles.dropdownItem} onClick={() => { setTheme('dark'); setShowAvatarMenu(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>{t('money.dark')}</span>
                  {theme === 'dark' && <span className={styles.dropdownCheck}>✓</span>}
                </button>
                <button className={styles.dropdownItem} onClick={() => { setTheme('system'); setShowAvatarMenu(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>{t('money.system')}</span>
                  {theme === 'system' && <span className={styles.dropdownCheck}>✓</span>}
                </button>
                <div className={styles.dropdownDivider} />
                <button className={styles.dropdownItem} onClick={() => { setShowAvatarMenu(false); setShowLogoutConfirm(true) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span style={{ color: '#EF4444' }}>{t('auth.logout')}</span>
                </button>
              </div>
            )}
          </div>
          <div className={styles.userText}>
            <span className={styles.userName}>{userData?.name || userData?.email || 'User'}</span>
            <span className={styles.userPlan}>{plan === 'pro' ? 'Pro' : plan === 'admin' ? 'Admin' : 'Free'}</span>
          </div>
        </div>
        <Link href="/ai" className={styles.askBtn} aria-label={t('ai.title')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.3A8 8 0 1 1 21 12z" />
          </svg>
        </Link>
      </header>

      <TodayCard today={today} />

      <div className={styles.homeActions}>
        <button type="button" className={styles.primaryAction} onClick={() => openModal('expense')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          {t('dashboard.addExpense')}
        </button>
        <button type="button" className={styles.secondaryAction} onClick={() => openModal('purchase')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2.5l2.4 11h10.2l2-8H7" /></svg>
          {t('quick.purchase')}
        </button>
      </div>

      {today?.hasPlan && wallets.length === 0 && (
        <section className={styles.promptCard}>
          <h2>{t('plan.noWalletTitle')}</h2>
          <p>{t('plan.noWalletBody')}</p>
          <button type="button" className={styles.primaryAction} onClick={() => setShowAddWallet(true)}>{t('plan.addWallet')}</button>
        </section>
      )}

      {showPayday && (
        <section className={styles.promptCard}>
          <h2>{t('plan.paydayTitle')}</h2>
          <p>{t('plan.paydayBody')}</p>
          <div className={styles.promptActions}>
            <button type="button" className={styles.primaryAction} onClick={() => openModal('income', { amount: today.plan.income, source: t('onboarding.defaultSource') })}>{t('plan.paydayCta')}</button>
            <button type="button" className={styles.secondaryAction} onClick={dismissPayday}>{t('plan.paydayLater')}</button>
          </div>
        </section>
      )}

      {user && <FixedDueCard uid={user.uid} budget={budgetData} today={today} variant="due" />}

      <Reveal delay={100} style={{ position: 'relative', zIndex: 20 }}>
      <div className={styles.walletsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.wallets')}</h2>
          <div className={styles.walletActions}>
            {wallets.length > 1 && (
              <button type="button" className={styles.walletHeaderBtn} onClick={() => setShowTransfer(true)}>
                <TransferIcon /> {t('dashboard.transfer')}
              </button>
            )}
            {wallets.length > 0 && (
              <button type="button" className={styles.walletHeaderBtn} onClick={() => setShowAddWallet(true)}>
                <PlusIcon /> {t('dashboard.addWallet')}
              </button>
            )}
          </div>
        </div>
        <p className={styles.walletsHelp}>{t('money.walletsHelp')}</p>
        {wallets.length > 0 ? (
          <>
            <div className={styles.walletGrid}>
              {wallets.map((w) => {
                const wt = WALLET_TYPES.find((t) => t.id === w.type)
                return (
                  <div key={w.id} className={styles.walletCard} style={{ borderTopColor: w.color || '#4DA3FF' }} onClick={() => setEditingWallet(w)}>
                    <div className={styles.walletTop}>
                      <span className={styles.walletEmoji}>{wt?.emoji || '💳'}</span>
                      <span className={styles.walletType}>{wt?.labelAr || w.type}</span>
                    </div>
                    <span className={styles.walletName}>{w.name}</span>
                    <span className={styles.walletBalance}>
                      {currency} <AnimatedNumber value={w.balance} decimals={0} />
                    </span>
                  </div>
                )
              })}
            </div>
            <div className={styles.walletSwiper} ref={swiperRef}>
              {wallets.map((w) => {
                const wt = WALLET_TYPES.find((t) => t.id === w.type)
                return (
                  <div key={w.id} className={styles.swiperCard} style={{ borderTopColor: w.color || '#4DA3FF' }} onClick={() => setEditingWallet(w)}>
                    <div className={styles.walletTop}>
                      <span className={styles.walletEmoji}>{wt?.emoji || '💳'}</span>
                      <span className={styles.walletType}>{wt?.labelAr || w.type}</span>
                    </div>
                    <span className={styles.walletName}>{w.name}</span>
                    <span className={styles.walletBalance}>
                      {currency} <AnimatedNumber value={w.balance} decimals={0} />
                    </span>
                  </div>
                )
              })}
            </div>
            <div className={styles.swiperDots}>
              {Array.from({ length: wallets.length }).map((_, i) => (
                <span key={i} className={`${styles.swiperDot} ${i === activeWalletIdx ? styles.swiperDotActive : ''}`} />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.walletsEmpty}>
            <p className={styles.walletsEmptyText}>{t('dashboard.noWallets')}</p>
            <p className={styles.walletsEmptyHint}>{t('dashboard.createFirstWallet')}</p>
            <button className={styles.emptyAddWalletBtn} onClick={() => setShowAddWallet(true)}>
              <PlusIcon /> {t('dashboard.addWallet')}
            </button>
          </div>
        )}
      </div>
      </Reveal>


      <Reveal delay={300} className={styles.dashboardSection}>
      <section className={styles.transactions}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.todayTransactions')}</h2>
          {recent.length > 0 && (
            <span className={styles.viewAll}>(tap to edit)</span>
          )}
        </div>
        {recent.length > 0 ? (
          <div className={styles.transactionList}>
            {recent.map((t) => {
              return (
                <div key={t.id} className={styles.transactionItem} onClick={() => setEditingTx(t)}>
                  <CategoryIcon id={t.category} size={20} tile />
                  <div className={styles.txInfo}>
                    <span className={styles.txName}>{t.merchant || t.category || 'Transaction'}</span>
                    <span className={styles.txMeta}>
                      {t.category}
                      {t.reason && <span className={styles.txReason}> · {t.reason}</span>}
                      {t.walletName && <span className={styles.txWallet}> · {t.walletName}</span>}
                    </span>
                  </div>
                  <div className={styles.txRight}>
                    <span className={`${styles.txAmount} ${t.type === 'income' ? styles.txPositive : t.type === 'transfer' ? styles.txNeutral : styles.txNegative}`}>
                      {t.type === 'income' ? '+' : t.type === 'transfer' ? '↔' : '-'}{t.currency || currency} {new Intl.NumberFormat('en-US').format(Number(t.amount))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{t('transactions.noTransactions')}</p>
            <p className={styles.emptyHint}>{t('money.noTxHint')}</p>
          </div>
        )}
      </section>
      </Reveal>


      {/* Room so the floating voice button never covers the last row */}
      <div className={styles.voiceSpacer} aria-hidden="true" />
      <VoiceButton />

      {showAddWallet && user && (
        <AddWalletModal uid={user.uid} onClose={() => setShowAddWallet(false)} />
      )}

      {editingWallet && user && (
        <AddWalletModal uid={user.uid} wallet={editingWallet} onClose={() => setEditingWallet(null)} />
      )}

      {showTransfer && user && wallets.length > 1 && (
        <TransferMoneyModal uid={user.uid} wallets={wallets} onClose={() => setShowTransfer(false)} />
      )}

      {editingTx && user && (
        <EditTransactionModal
          uid={user.uid}
          transaction={editingTx}
          wallets={wallets}
          onClose={() => setEditingTx(null)}
          budgetCategories={budgetCategories}
        />
      )}

      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('auth.logout')}
        message={t('auth.logoutConfirm')}
        confirmLabel={t('auth.logout')}
        onConfirm={() => { setShowLogoutConfirm(false); logout() }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  )
}
