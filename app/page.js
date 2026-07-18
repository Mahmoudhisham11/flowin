'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useSubscription } from '@/hooks/useSubscription'
import { BellIcon, PlusIcon, TransferIcon } from '@/components/Icons'
import { subscribeToTransactions } from '@/services/transactionsService'
import { subscribeToWallets, WALLET_TYPES } from '@/services/walletService'
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/notificationService'
import { subscribeToBudget } from '@/services/budgetService'
import { getCategory } from '@/lib/categories'
import BalanceCard from '@/components/features/BalanceCard'
import AddWalletModal from '@/components/features/AddWalletModal'
import AddIncomeModal from '@/components/features/AddIncomeModal'
import AddExpenseModal from '@/components/features/AddExpenseModal'
import TransferMoneyModal from '@/components/features/TransferMoneyModal'
import EditTransactionModal from '@/components/features/EditTransactionModal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import Reveal from '@/components/features/Reveal'
import VoiceButton from '@/components/voice/VoiceButton'
import styles from './page.module.css'
import { useTranslation } from '@/hooks/useTranslation'

export default function Home() {
  const { user, userData, logout } = useUser()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { plan } = useSubscription()
  const [showBalance, setShowBalance] = useState(true)
  const [transactions, setTransactions] = useState([])
  const [wallets, setWallets] = useState([])
  const [showAddWallet, setShowAddWallet] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [editingWallet, setEditingWallet] = useState(null)
  const [editingTx, setEditingTx] = useState(null)
  const [showActions, setShowActions] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [activeWalletIdx, setActiveWalletIdx] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)
  const [budgetCategories, setBudgetCategories] = useState([])
  const actionRef = useRef(null)
  const swiperRef = useRef(null)
  const avatarMenuRef = useRef(null)
  const notifRef = useRef(null)
  const { t } = useTranslation()
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    const handleClick = (e) => {
      if (actionRef.current && !actionRef.current.contains(e.target)) {
        setShowActions(false)
      }
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) {
        setShowAvatarMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false)
      }
    }
    if (showActions || showAvatarMenu || showNotifDropdown) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showActions, showAvatarMenu, showNotifDropdown])

  useEffect(() => {
    if (!user) return
    const unsubTx = subscribeToTransactions(user.uid, setTransactions)
    const unsubWallets = subscribeToWallets(user.uid, setWallets)
    const unsubNotif = subscribeToNotifications(user.uid, setNotifications)
    const unsubBudget = subscribeToBudget(user.uid, (data) => {
      setBudgetCategories(data?.essentialCategories || [])
    })
    return () => { unsubTx(); unsubWallets(); unsubNotif(); unsubBudget() }
  }, [user])

  const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0)

  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)

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
                  <span>Light</span>
                  {theme === 'light' && <span className={styles.dropdownCheck}>✓</span>}
                </button>
                <button className={styles.dropdownItem} onClick={() => { setTheme('dark'); setShowAvatarMenu(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                  <span>Dark</span>
                  {theme === 'dark' && <span className={styles.dropdownCheck}>✓</span>}
                </button>
                <button className={styles.dropdownItem} onClick={() => { setTheme('system'); setShowAvatarMenu(false) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <span>System</span>
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
        <div className={styles.notifWrap} ref={notifRef}>
          <button className={styles.notifBtn} onClick={() => setShowNotifDropdown((prev) => !prev)}>
            <BellIcon />
            {unreadCount > 0 && <span className={styles.notifBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          {showNotifDropdown && (
            <div className={styles.notifDropdown}>
              <div className={styles.notifDropdownHeader}>
                <span className={styles.notifDropdownTitle}>Notifications</span>
                {unreadCount > 0 && (
                  <button className={styles.notifMarkAllBtn} onClick={() => markAllNotificationsRead(user.uid)}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className={styles.notifList}>
                {notifications.length === 0 ? (
                  <div className={styles.notifEmpty}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`${styles.notifItem} ${n.read ? styles.notifItemRead : ''}`}
                      onClick={() => { if (!n.read) markNotificationRead(user.uid, n.id) }}
                    >
                      <div className={styles.notifDot} data-read={n.read ? '' : undefined} />
                      <div className={styles.notifContent}>
                        <div className={styles.notifTitle}>{n.title}</div>
                        <div className={styles.notifMessage}>{n.message}</div>
                        <div className={styles.notifTime}>{new Date(n.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <BalanceCard
        balance={totalBalance}
        showBalance={showBalance}
        onToggle={() => setShowBalance((prev) => !prev)}
      />

      <Reveal delay={100}>
      <div className={styles.walletsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('dashboard.wallets')}</h2>
          <div className={styles.walletActions}>
            <div className={styles.actionBtnsDesktop}>
              <button className={styles.incomeBtn} onClick={() => setShowAddIncome(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                {t('dashboard.addIncome')}
              </button>
              <button className={styles.expenseBtn} onClick={() => setShowAddExpense(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
                {t('dashboard.addExpense')}
              </button>
              <button className={styles.transferBtn} onClick={() => setShowTransfer(true)}>
                <TransferIcon /> {t('dashboard.transfer')}
              </button>
              <button className={styles.addWalletBtn} onClick={() => setShowAddWallet(true)}>
                <PlusIcon /> {t('dashboard.addWallet')}
              </button>
            </div>
            <div className={styles.actionDropdown} ref={actionRef}>
              <button className={styles.moreBtn} onClick={() => setShowActions((prev) => !prev)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {showActions && (
                <div className={styles.dropdownMenu}>
                  <button onClick={() => { setShowAddIncome(true); setShowActions(false) }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                    </svg>
                    {t('dashboard.addIncome')}
                  </button>
                  <button onClick={() => { setShowAddExpense(true); setShowActions(false) }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                    </svg>
                    {t('dashboard.addExpense')}
                  </button>
                  <button onClick={() => { setShowTransfer(true); setShowActions(false) }}>
                    <TransferIcon /> {t('dashboard.transfer')}
                  </button>
                  <button onClick={() => { setShowAddWallet(true); setShowActions(false) }}>
                    <PlusIcon /> {t('dashboard.addWallet')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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
                      EGP <AnimatedNumber value={w.balance} decimals={0} />
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
                      EGP <AnimatedNumber value={w.balance} decimals={0} />
                    </span>
                  </div>
                )
              })}
            </div>
            <div className={styles.swiperDots}>
              {wallets.map((_, i) => (
                <span key={i} className={`${styles.swiperDot} ${i === activeWalletIdx ? styles.swiperDotActive : ''}`} />
              ))}
            </div>
          </>
        ) : (
          <div className={styles.walletsEmpty}>
            <p className={styles.walletsEmptyText}>No wallets yet</p>
            <p className={styles.walletsEmptyHint}>Create your first wallet to start tracking your money</p>
          </div>
        )}
      </div>
      </Reveal>

      <Reveal delay={200}>
      <div className={styles.statsRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <h3 className={styles.summaryTitle}>{t('dashboard.totalCapital')}</h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className={styles.summaryAmounts}>
            <span className={styles.summarySpent}>EGP <AnimatedNumber value={totalBalance} decimals={0} /></span>
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressBar}
              style={{ width: `${totalBalance > 0 ? Math.min((expenses / totalBalance) * 100, 100) : 0}%` }}
            />
          </div>
          <div className={styles.summarySpentSoFar}>
            <span className={styles.spentLabel}>{t('dashboard.spentSoFar')}</span>
            <span className={styles.spentAmount}>EGP <AnimatedNumber value={expenses} decimals={0} /></span>
          </div>
          {totalBalance === 0 && transactions.length === 0 && (
            <p className={styles.summaryNote}>
              Add money to your wallets to start tracking
            </p>
          )}
        </div>

        <div className={styles.quickStats}>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
            </span>
            <span className={styles.statLabel}>{t('common.income')}</span>
            <span className={styles.statValue}>EGP <AnimatedNumber value={income} decimals={0} /></span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </span>
            <span className={styles.statLabel}>{t('common.expense')}</span>
            <span className={styles.statValue}>EGP <AnimatedNumber value={expenses} decimals={0} /></span>
          </div>
        </div>
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
              const category = getCategory(t.category)
              return (
                <div key={t.id} className={styles.transactionItem} onClick={() => setEditingTx(t)}>
                  <div className={styles.txAvatar} style={{ background: `${category.color}20` }}>
                    <span>{category.emoji}</span>
                  </div>
                  <div className={styles.txInfo}>
                    <span className={styles.txName}>{t.merchant || t.category || 'Transaction'}</span>
                    <span className={styles.txMeta}>
                      {category.emoji} {t.category}
                      {t.walletName && <span className={styles.txWallet}> · {t.walletName}</span>}
                    </span>
                  </div>
                  <div className={styles.txRight}>
                    <span className={`${styles.txAmount} ${t.type === 'income' ? styles.txPositive : t.type === 'transfer' ? styles.txNeutral : styles.txNegative}`}>
                      {t.type === 'income' ? '+' : t.type === 'transfer' ? '↔' : '-'}{t.currency || 'EGP'} {new Intl.NumberFormat('en-US').format(Number(t.amount))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{t('transactions.noTransactions')}</p>
            <p className={styles.emptyHint}>Add your first transaction to get started</p>
          </div>
        )}
      </section>
      </Reveal>

      <VoiceButton />

      {showAddWallet && user && (
        <AddWalletModal uid={user.uid} onClose={() => setShowAddWallet(false)} />
      )}

      {editingWallet && user && (
        <AddWalletModal uid={user.uid} wallet={editingWallet} onClose={() => setEditingWallet(null)} />
      )}

      {showAddIncome && user && wallets.length > 0 && (
        <AddIncomeModal uid={user.uid} wallets={wallets} onClose={() => setShowAddIncome(false)} />
      )}

      {showAddExpense && user && wallets.length > 0 && (
        <AddExpenseModal uid={user.uid} wallets={wallets} onClose={() => setShowAddExpense(false)} />
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

