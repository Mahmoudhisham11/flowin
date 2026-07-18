'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon } from '@/components/Icons'
import { subscribeToDebts, createDebt, updateDebt, deleteDebt } from '@/services/debtsService'
import { subscribeToPayments, createPayment, deletePayment } from '@/services/debtPaymentsService'
import { subscribeToWallets, updateWallet } from '@/services/walletService'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function DebtsPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const debtTypes = [
    { value: 'lend', label: t('debts.lend') },
    { value: 'borrow', label: t('debts.borrow') },
  ]
  const [debts, setDebts] = useState([])
  const [wallets, setWallets] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editDebt, setEditDebt] = useState(null)
  const [form, setForm] = useState({ personName: '', phone: '', amount: '', type: 'lend', walletId: '' })

  const [paymentsDebt, setPaymentsDebt] = useState(null)
  const [payments, setPayments] = useState([])
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentWallet, setPaymentWallet] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [showDeleteDebtConfirm, setShowDeleteDebtConfirm] = useState(null)
  const [showDeletePaymentConfirm, setShowDeletePaymentConfirm] = useState(null)

  useEffect(() => {
    if (!user) return
    const unsub1 = subscribeToDebts(user.uid, setDebts)
    const unsub2 = subscribeToWallets(user.uid, setWallets)
    return () => { unsub1(); unsub2() }
  }, [user])

  useEffect(() => {
    if (!user || !paymentsDebt) return
    const unsub = subscribeToPayments(user.uid, paymentsDebt.id, setPayments)
    return () => { unsub(); setPayments([]) }
  }, [user, paymentsDebt])

  const resetForm = () => setForm({ personName: '', phone: '', amount: '', type: 'lend', walletId: '' })

  const openAdd = () => {
    setEditDebt(null)
    resetForm()
    if (wallets.length > 0) setForm((f) => ({ ...f, walletId: wallets[0].id }))
    setShowModal(true)
  }

  const openEdit = (debt) => {
    setEditDebt(debt)
    setForm({
      personName: debt.personName,
      phone: debt.phone || '',
      amount: String(debt.amount),
      type: debt.type,
      walletId: debt.walletId,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.personName || !form.amount || !form.walletId) return
    if (!user) return

    try {
      const amount = parseFloat(form.amount)
      if (amount <= 0) return

      if (editDebt) {
        const diff = amount - editDebt.amount
        if (diff !== 0) {
          const wallet = wallets.find((w) => w.id === form.walletId)
          const balance = Number(wallet?.balance || 0)
          if (form.type === 'lend') {
            await updateWallet(user.uid, form.walletId, { balance: balance + diff })
          } else {
            if (balance < diff) {
              alert(t('debts.insufficientBalance'))
              return
            }
            await updateWallet(user.uid, form.walletId, { balance: balance - diff })
          }
        }
        const paid = Number(editDebt.paid || 0)
        await updateDebt(user.uid, editDebt.id, {
          personName: form.personName,
          phone: form.phone,
          amount,
          type: form.type,
          walletId: form.walletId,
          remaining: Math.max(amount - paid, 0),
        })
      } else {
        const wallet = wallets.find((w) => w.id === form.walletId)
        if (!wallet) return
        const balance = Number(wallet.balance || 0)

        if (form.type === 'lend') {
          await updateWallet(user.uid, form.walletId, { balance: balance + amount })
        } else {
          if (balance < amount) {
            alert(t('debts.insufficientBalance'))
            return
          }
          await updateWallet(user.uid, form.walletId, { balance: balance - amount })
        }

        await createDebt(user.uid, {
          personName: form.personName,
          phone: form.phone,
          amount,
          type: form.type,
          walletId: form.walletId,
          walletName: wallet.name,
        })
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save debt', err)
    }
  }

  const handleDeleteDebt = async () => {
    if (!user || !showDeleteDebtConfirm) return
    try {
      const debt = debts.find((d) => d.id === showDeleteDebtConfirm)
      if (debt) {
        const wallet = wallets.find((w) => w.id === debt.walletId)
        if (wallet) {
          const balance = Number(wallet.balance || 0)
          if (debt.type === 'lend') {
            await updateWallet(user.uid, debt.walletId, { balance: balance - Number(debt.remaining || 0) })
          } else {
            await updateWallet(user.uid, debt.walletId, { balance: balance + Number(debt.remaining || 0) })
          }
        }
      }
      await deleteDebt(user.uid, showDeleteDebtConfirm)
      setShowDeleteDebtConfirm(null)
    } catch (err) {
      console.error('Failed to delete debt', err)
    }
  }

  const openPayments = (debt) => {
    setPaymentsDebt(debt)
    setPaymentAmount('')
    if (wallets.length > 0) setPaymentWallet(wallets[0].id)
  }

  const handleAddPayment = async () => {
    if (!paymentsDebt || !paymentAmount || !paymentWallet || !user) return
    const amount = parseFloat(paymentAmount)
    if (amount <= 0) return
    setPaymentLoading(true)

    try {
      const wallet = wallets.find((w) => w.id === paymentWallet)
      if (!wallet) return
      const balance = Number(wallet.balance || 0)

      if (paymentsDebt.type === 'lend') {
        if (balance < amount) {
          alert(t('debts.insufficientWallet'))
          setPaymentLoading(false)
          return
        }
        await updateWallet(user.uid, paymentWallet, { balance: balance - amount })
      } else {
        await updateWallet(user.uid, paymentWallet, { balance: balance + amount })
      }

      const paidSoFar = Number(paymentsDebt.paid || 0) + amount
      const remaining = Math.max(Number(paymentsDebt.amount) - paidSoFar, 0)

      await createPayment(user.uid, paymentsDebt.id, {
        amount,
        walletId: paymentWallet,
        walletName: wallet.name,
      })

      await updateDebt(user.uid, paymentsDebt.id, { paid: paidSoFar, remaining })
      setPaymentsDebt((prev) => prev ? { ...prev, paid: paidSoFar, remaining } : null)
      setPaymentAmount('')
    } catch (err) {
      console.error('Failed to add payment', err)
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!user || !showDeletePaymentConfirm || !paymentsDebt) return
    try {
      const payment = payments.find((p) => p.id === showDeletePaymentConfirm)
      if (!payment) return

      const wallet = wallets.find((w) => w.id === payment.walletId)
      if (wallet) {
        const balance = Number(wallet.balance || 0)
        if (paymentsDebt.type === 'lend') {
          await updateWallet(user.uid, payment.walletId, { balance: balance + Number(payment.amount) })
        } else {
          await updateWallet(user.uid, payment.walletId, { balance: balance - Number(payment.amount) })
        }
      }

      const paidSoFar = Math.max(Number(paymentsDebt.paid || 0) - Number(payment.amount), 0)
      const remaining = Math.max(Number(paymentsDebt.amount) - paidSoFar, 0)

      await deletePayment(user.uid, paymentsDebt.id, showDeletePaymentConfirm)
      await updateDebt(user.uid, paymentsDebt.id, { paid: paidSoFar, remaining })
      setPaymentsDebt((prev) => prev ? { ...prev, paid: paidSoFar, remaining } : null)
      setShowDeletePaymentConfirm(null)
    } catch (err) {
      console.error('Failed to delete payment', err)
    }
  }

  const totalLend = debts.filter((d) => d.type === 'lend').reduce((s, d) => s + Number(d.remaining || 0), 0)
  const totalBorrow = debts.filter((d) => d.type === 'borrow').reduce((s, d) => s + Number(d.remaining || 0), 0)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('debts.title')}</h1>
          <p className={styles.subtitle}>{t('debts.subtitle')}</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <PlusIcon width="18" height="18" />
          <span>{t('debts.newDebt')}</span>
        </button>
      </header>

      <div className={styles.summary}>
        <div className={styles.summaryCard} style={{ borderLeft: '4px solid #22C55E' }}>
          <span className={styles.summaryLabel}>{t('debts.someoneOwesMe')}</span>
          <span className={styles.summaryValue} style={{ color: '#22C55E' }}>EGP <AnimatedNumber value={totalLend} decimals={0} /></span>
        </div>
        <div className={styles.summaryCard} style={{ borderLeft: '4px solid #EF4444' }}>
          <span className={styles.summaryLabel}>{t('debts.iOweSomeone')}</span>
          <span className={styles.summaryValue} style={{ color: '#EF4444' }}>EGP <AnimatedNumber value={totalBorrow} decimals={0} /></span>
        </div>
      </div>

      {debts.length > 0 ? (
        <div className={styles.grid}>
          {debts.map((debt) => {
            const pct = debt.amount > 0 ? Math.min(Math.round((Number(debt.paid || 0) / Number(debt.amount)) * 100), 100) : 0
            const isLend = debt.type === 'lend'
            return (
              <div key={debt.id} className={styles.debtCard}>
                <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setShowDeleteDebtConfirm(debt.id) }}>
                  <CloseIcon width="14" height="14" />
                </button>
                <div className={styles.debtTop}>
                  <div className={`${styles.debtBadge} ${isLend ? styles.lendBadge : styles.borrowBadge}`}>
                    {isLend ? t('debts.lend') : t('debts.borrow')}
                  </div>
                </div>
                <h3 className={styles.debtName}>{debt.personName}</h3>
                {debt.phone && <span className={styles.debtPhone}>{debt.phone}</span>}
                <div className={styles.debtAmounts}>
                  <span className={styles.debtTotal}>EGP <AnimatedNumber value={Number(debt.amount)} decimals={0} /></span>
                </div>
                <div className={styles.debtProgress}>
                  <div className={styles.debtProgressTrack}>
                    <div className={styles.debtProgressBar} style={{ width: `${pct}%`, background: isLend ? '#22C55E' : '#EF4444' }} />
                  </div>
                  <span className={styles.debtProgressPct}>{pct}% {t('debts.paid')}</span>
                </div>
                <div className={styles.debtMeta}>
                  <span>{t('debts.paid')}: EGP {Intl.NumberFormat('en-US').format(Number(debt.paid || 0))}</span>
                  <span>{t('debts.remaining')}: EGP {Intl.NumberFormat('en-US').format(Number(debt.remaining || 0))}</span>
                </div>
                <div className={styles.debtWallet}>{t('common.from')} {debt.walletName || t('debts.wallet')}</div>
                <div className={styles.debtActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(debt)}>{t('edit')}</button>
                  <button className={styles.payBtn} onClick={() => openPayments(debt)}>{t('debts.payments')}</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('debts.noDebts')}</p>
          <p className={styles.emptyHint}>{t('debts.noDebtsHint')}</p>
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editDebt ? t('debts.editDebt') : t('debts.newDebt')}</h2>
              <button className={styles.modalClose} onClick={() => { setShowModal(false); resetForm() }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('debts.personName')}</label>
                <input className={styles.fieldInput} type="text" placeholder="e.g. Ahmed Ali" value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('debts.phoneNumber')}</label>
                <input className={styles.fieldInput} type="text" placeholder="e.g. 01012345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('debts.amount')}</label>
                <input className={styles.fieldInput} type="number" placeholder="1000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('debts.debtType')}</label>
                <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                  options={debtTypes} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('debts.wallet')}</label>
                <Select value={form.walletId} onChange={(v) => setForm({ ...form, walletId: v })}
                  options={wallets.map((w) => ({ value: w.id, label: `${w.name} (EGP ${Intl.NumberFormat('en-US').format(Number(w.balance))})` }))} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm() }}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave}>{editDebt ? t('common.update') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {paymentsDebt && (
        <div className={styles.overlay} onClick={() => setPaymentsDebt(null)}>
          <div className={styles.paymentsModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle}>{t('debts.payments')} - {paymentsDebt.personName}</h2>
                <span className={styles.paymentsSubtitle}>
                  {t('debts.remaining')}: EGP {Intl.NumberFormat('en-US').format(Number(paymentsDebt.remaining || 0))}
                </span>
              </div>
              <button className={styles.modalClose} onClick={() => setPaymentsDebt(null)}>
                <CloseIcon />
              </button>
            </div>

            <div className={styles.paymentsList}>
              {payments.length > 0 ? (
                payments.map((p) => (
                  <div key={p.id} className={styles.paymentItem}>
                    <div className={styles.paymentInfo}>
                      <span className={styles.paymentAmount}>EGP {Intl.NumberFormat('en-US').format(Number(p.amount))}</span>
                      <span className={styles.paymentWallet}>{p.walletName}</span>
                      <span className={styles.paymentDate}>{new Date(p.createdAt).toLocaleDateString()}</span>
                    </div>
                    <button className={styles.paymentDelete} onClick={() => setShowDeletePaymentConfirm(p.id)}>
                      <CloseIcon width="12" height="12" />
                    </button>
                  </div>
                ))
              ) : (
                <div className={styles.paymentsEmpty}>{t('debts.noPayments')}</div>
              )}
            </div>

            <div className={styles.paymentsAdd}>
              <div className={styles.paymentsAddRow}>
                <input className={styles.fieldInput} type="number" placeholder={t('common.amount')} value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)} style={{ flex: 1 }} />
                <button className={styles.addPaymentBtn} onClick={handleAddPayment}
                  disabled={paymentLoading || !paymentAmount}>
                  {paymentLoading ? '...' : t('debts.pay')}
                </button>
              </div>
              {wallets.length > 0 && (
                <Select value={paymentWallet} onChange={setPaymentWallet}
                  options={wallets.map((w) => ({ value: w.id, label: `${w.name} (EGP ${Intl.NumberFormat('en-US').format(Number(w.balance))})` }))} />
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!showDeleteDebtConfirm}
        title={t('debts.deleteDebt')}
        message={t('debts.deleteDebtMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDeleteDebt}
        onCancel={() => setShowDeleteDebtConfirm(null)}
      />
      <ConfirmDialog
        open={!!showDeletePaymentConfirm}
        title={t('debts.deletePayment')}
        message={t('debts.deletePaymentMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDeletePayment}
        onCancel={() => setShowDeletePaymentConfirm(null)}
      />
    </div>
  )
}
