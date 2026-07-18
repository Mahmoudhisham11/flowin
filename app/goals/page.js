'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon } from '@/components/Icons'
import { subscribeToGoals, createGoal, updateGoal, deleteGoal, addMoneyToGoal, withdrawFromGoal } from '@/services/goalsService'
import { subscribeToWallets } from '@/services/walletService'
import { CATEGORIES } from '@/lib/categories'
import Select from '@/components/ui/Select'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function GoalsPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const [goals, setGoals] = useState([])
  const [wallets, setWallets] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editGoal, setEditGoal] = useState(false)
  const [form, setForm] = useState({ name: '', targetAmount: '', deadline: '', walletId: '' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [showMoneyModal, setShowMoneyModal] = useState(null)
  const [moneyAction, setMoneyAction] = useState('add')
  const [moneyAmount, setMoneyAmount] = useState('')
  const [moneyWallet, setMoneyWallet] = useState('')

  useEffect(() => {
    if (!user) return
    const unsub1 = subscribeToGoals(user.uid, setGoals)
    const unsub2 = subscribeToWallets(user.uid, setWallets)
    return () => { unsub1(); unsub2() }
  }, [user])

  const resetForm = () => setForm({ name: '', targetAmount: '', deadline: '', walletId: '' })

  const openAdd = () => {
    setEditGoal(null)
    resetForm()
    if (wallets.length > 0) setForm((f) => ({ ...f, walletId: wallets[0].id }))
    setShowModal(true)
  }

  const openEdit = (goal) => {
    setEditGoal(goal)
    setForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      deadline: goal.deadline || '',
      walletId: goal.walletId || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.targetAmount || !user) return
    try {
      const data = {
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        deadline: form.deadline,
        walletId: form.walletId,
      }
      if (editGoal) {
        await updateGoal(user.uid, editGoal.id, data)
      } else {
        await createGoal(user.uid, data)
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save goal', err)
    }
  }

  const handleDelete = async () => {
    if (!user || !showDeleteConfirm) return
    try {
      await deleteGoal(user.uid, showDeleteConfirm)
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete goal', err)
    }
  }

  const openMoneyModal = (goal, action) => {
    setShowMoneyModal(goal)
    setMoneyAction(action)
    setMoneyAmount('')
    if (wallets.length > 0) setMoneyWallet(wallets[0].id)
  }

  const handleMoney = async () => {
    if (!showMoneyModal || !moneyAmount || !moneyWallet || !user) return
    const amount = parseFloat(moneyAmount)
    if (amount <= 0) return
    try {
      const wallet = wallets.find((w) => w.id === moneyWallet)
      if (!wallet) return
      if (moneyAction === 'add') {
        if (wallet.balance < amount) return
        await addMoneyToGoal(user.uid, showMoneyModal.id, showMoneyModal, amount, moneyWallet, wallet)
      } else {
        if (showMoneyModal.saved < amount) return
        await withdrawFromGoal(user.uid, showMoneyModal.id, showMoneyModal, amount, moneyWallet, wallet)
      }
      setShowMoneyModal(null)
    } catch (err) {
      console.error('Failed to update goal money', err)
    }
  }

  const getDaysLeft = (deadline) => {
    if (!deadline) return null
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const isOverdue = (goal) => {
    if (!goal.deadline) return false
    return new Date(goal.deadline) < new Date() && goal.saved < goal.targetAmount
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('goals.title')}</h1>
          <p className={styles.subtitle}>{t('goals.subtitle')}</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <PlusIcon width="18" height="18" />
          <span>{t('goals.newGoal')}</span>
        </button>
      </header>

      {goals.length > 0 ? (
        <div className={styles.grid}>
          {goals.map((goal) => {
            const pct = goal.targetAmount > 0 ? Math.min(Math.round((goal.saved / goal.targetAmount) * 100), 100) : 0
            const daysLeft = getDaysLeft(goal.deadline)
            const overdue = isOverdue(goal)
            return (
              <div key={goal.id} className={`${styles.goalCard} ${overdue ? styles.goalOverdue : ''}`}>
                <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(goal.id) }}>
                  <CloseIcon width="14" height="14" />
                </button>
                <h3 className={styles.goalName}>{goal.name}</h3>
                <div className={styles.goalAmounts}>
                  <span className={styles.goalSaved}>EGP <AnimatedNumber value={goal.saved} decimals={0} /></span>
                  <span className={styles.goalTarget}>/ EGP {Intl.NumberFormat('en-US').format(Number(goal.targetAmount))}</span>
                </div>
                <div className={styles.goalProgress}>
                  <div className={styles.goalProgressTrack}>
                    <div className={`${styles.goalProgressBar} ${overdue ? styles.goalBarOverdue : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.goalProgressPct}>{pct}%</span>
                </div>
                {goal.deadline && (
                  <div className={`${styles.goalDeadline} ${overdue ? styles.deadlineOverdue : ''}`}>
                    {overdue ? t('goals.overdue') : `${daysLeft} ${t('goals.daysLeft')}`}
                  </div>
                )}
                <div className={styles.goalActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(goal)}>{t('edit')}</button>
                  <button className={styles.addMoneyBtn} onClick={() => openMoneyModal(goal, 'add')}>{t('goals.addMoney')}</button>
                  <button className={styles.withdrawBtn} onClick={() => openMoneyModal(goal, 'withdraw')}>{t('goals.withdraw')}</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('goals.noGoals')}</p>
          <p className={styles.emptyHint}>{t('goals.noGoalsHint')}</p>
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editGoal ? t('goals.editGoal') : t('goals.newGoal')}</h2>
              <button className={styles.modalClose} onClick={() => { setShowModal(false); resetForm() }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('goals.goalName')}</label>
                <input className={styles.fieldInput} type="text" placeholder="e.g. Emergency Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('goals.targetAmount')}</label>
                <input className={styles.fieldInput} type="number" placeholder="10000" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('goals.deadline')}</label>
                <input className={styles.fieldInput} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm() }}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave}>{editGoal ? t('common.update') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {showMoneyModal && (
        <div className={styles.overlay} onClick={() => setShowMoneyModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{moneyAction === 'add' ? t('goals.addMoneyTo') : t('goals.withdrawFrom')} {showMoneyModal.name}</h2>
              <button className={styles.modalClose} onClick={() => setShowMoneyModal(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.moneyInfo}>
                <span>{t('goals.currentSaved')}: EGP {Intl.NumberFormat('en-US').format(Number(showMoneyModal.saved || 0))}</span>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('goals.amount')}</label>
                <input className={styles.fieldInput} type="number" placeholder="0" value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value)} autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('goals.wallet')}</label>
                <Select value={moneyWallet} onChange={setMoneyWallet}
                  options={wallets.map((w) => ({ value: w.id, label: `${w.name} (EGP ${Intl.NumberFormat('en-US').format(Number(w.balance))})` }))} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowMoneyModal(null)}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleMoney}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!showDeleteConfirm}
        title={t('goals.deleteGoal')}
        message={t('goals.deleteGoalMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}
