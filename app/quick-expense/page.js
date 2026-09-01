'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useLocale } from '@/contexts/LocaleContext'
import { fetchWallets, updateWallet, WALLET_TYPES } from '@/services/walletService'
import { saveTransaction } from '@/services/transactionsService'
import { CATEGORIES } from '@/lib/categories'
import { t } from '@/lib/translations'
import Link from 'next/link'
import styles from './page.module.css'

export default function QuickExpensePage() {
  const router = useRouter()
  const { user, userData } = useUser()
  const { lang } = useLocale()
  const isAr = lang === 'ar'

  const [wallets, setWallets] = useState([])
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('Food')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.uid) return
    const loadWallets = async () => {
      try {
        const list = await fetchWallets(user.uid)
        setWallets(list)
        if (list.length > 0) {
          setSelectedWalletId(list[0].id)
        }
      } catch (err) {
        console.error('Failed to load wallets:', err)
      }
    }
    loadWallets()
  }, [user])

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedWalletId) {
      setError(isAr ? 'برجاء اختيار المحفظة' : 'Please select a wallet')
      return
    }
    const num = parseFloat(amount)
    if (!num || num <= 0) {
      setError(isAr ? 'برجاء إدخال مبلغ صحيح' : 'Please enter a valid positive amount')
      return
    }

    setLoading(true)
    setError('')
    try {
      await saveTransaction(user.uid, {
        amount: num,
        currency: 'EGP',
        category,
        merchant: '',
        reason: reason.trim(),
        type: 'expense',
        source: 'quick-expense',
        walletId: selectedWalletId,
        walletName: selectedWallet?.name || '',
      })

      await updateWallet(user.uid, selectedWalletId, {
        balance: (selectedWallet?.balance || 0) - num,
      })

      setSuccess(true)
      setAmount('')
      setReason('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('quickExpense.title')}</h1>
        <p className={styles.subtitle}>{t('quickExpense.subtitle')}</p>
      </header>

      {/* iOS Shortcuts / Back Tap Banner */}
      <div className={styles.shortcutBanner}>
        <div className={styles.shortcutBannerIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <div className={styles.shortcutBannerContent}>
          <h3 className={styles.shortcutBannerTitle}>{t('quickExpense.shortcutPromoTitle')}</h3>
          <p className={styles.shortcutBannerDesc}>{t('quickExpense.shortcutPromoDesc')}</p>
        </div>
        <Link href="/settings" className={styles.shortcutBannerBtn}>
          {t('quickExpense.getStarted')}
        </Link>
      </div>

      <div className={styles.formCard}>
        {success ? (
          <div className={styles.successBox}>
            <div className={styles.successIconWrap}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className={styles.successTitle}>{t('quickExpense.successMsg')}</h3>
            <button className={styles.addAnotherBtn} onClick={() => setSuccess(false)}>
              {isAr ? 'تسجيل مصروف آخر' : 'Log Another Expense'}
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Wallet Selection */}
            <div className={styles.field}>
              <label className={styles.label}>{t('quickExpense.walletLabel')}</label>
              <div className={styles.walletGrid}>
                {wallets.map((w) => {
                  const wt = WALLET_TYPES.find((t) => t.id === w.type)
                  const active = selectedWalletId === w.id
                  return (
                    <button
                      key={w.id}
                      type="button"
                      className={`${styles.walletBtn} ${active ? styles.walletActive : ''}`}
                      onClick={() => setSelectedWalletId(w.id)}
                    >
                      <span className={styles.walletEmoji}>{wt?.emoji || '💳'}</span>
                      <div className={styles.walletInfo}>
                        <span className={styles.walletName}>{w.name}</span>
                        <span className={styles.walletBalance}>EGP {new Intl.NumberFormat('en-US').format(Number(w.balance || 0))}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Amount */}
            <div className={styles.field}>
              <label className={styles.label}>{t('quickExpense.amountLabel')}</label>
              <div className={styles.amountWrap}>
                <span className={styles.amountCurrency}>EGP</span>
                <input
                  className={styles.amountInput}
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Reason */}
            <div className={styles.field}>
              <label className={styles.label}>{t('quickExpense.reasonLabel')}</label>
              <input
                className={styles.input}
                type="text"
                placeholder={t('quickExpense.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Category Selection */}
            <div className={styles.field}>
              <label className={styles.label}>{t('quickExpense.categoryLabel')}</label>
              <div className={styles.categoryGrid}>
                {CATEGORIES.filter((c) => c.id !== 'Transfer').map((c) => {
                  const active = category === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`${styles.categoryBtn} ${active ? styles.categoryActive : ''}`}
                      style={active ? { borderColor: c.color, background: c.color + '15' } : {}}
                      onClick={() => setCategory(c.id)}
                    >
                      <span className={styles.categoryEmoji}>{c.emoji}</span>
                      <span className={styles.categoryName}>{isAr ? c.labelAr : c.labelEn}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? (isAr ? 'جاري الحفظ...' : 'Saving...') : t('quickExpense.saveBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
