'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon } from '@/components/Icons'
import { subscribeToDailyTasks, createDailyTask, toggleDailyTask, updateDailyTask, deleteDailyTask } from '@/services/dailyTasksService'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

const PRIORITIES = [
  { value: 'urgent', labelEn: 'Urgent', labelAr: 'مستعجل', color: '#EF4444', emoji: '🔴' },
  { value: 'important', labelEn: 'Important', labelAr: 'مهم', color: '#F59E0B', emoji: '🟡' },
  { value: 'normal', labelEn: 'Normal', labelAr: 'عادي', color: '#22C55E', emoji: '🟢' },
]

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

function formatTime12(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${m} ${ampm}`
}

export default function DailyTasksPage() {
  const { user, lang } = useUser()
  const { t } = useTranslation()
  const [tasks, setTasks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm] = useState({ title: '', time: '', priority: 'normal' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const today = getTodayDate()
  const isAr = lang === 'ar'

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToDailyTasks(user.uid, today, setTasks)
    return () => unsub()
  }, [user, today])

  const resetForm = () => setForm({ title: '', time: '', priority: 'normal' })

  const openAdd = () => {
    setEditTask(null)
    resetForm()
    setShowModal(true)
  }

  const openEdit = (task) => {
    setEditTask(task)
    setForm({ title: task.title, time: task.time || '', priority: task.priority || 'normal' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title || !user) return
    try {
      if (editTask) {
        await updateDailyTask(user.uid, editTask.id, {
          title: form.title,
          time: form.time,
          priority: form.priority,
        })
      } else {
        await createDailyTask(user.uid, {
          title: form.title,
          time: form.time,
          priority: form.priority,
          date: today,
        })
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save task', err)
    }
  }

  const handleToggle = async (task) => {
    if (!user) return
    try {
      await toggleDailyTask(user.uid, task.id, !task.completed)
    } catch (err) {
      console.error('Failed to toggle task', err)
    }
  }

  const handleDelete = async () => {
    if (!user || !showDeleteConfirm) return
    try {
      await deleteDailyTask(user.uid, showDeleteConfirm)
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete task', err)
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const pOrder = { urgent: 0, important: 1, normal: 2 }
    return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
  })

  const completedCount = tasks.filter((t) => t.completed).length
  const totalCount = tasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('dailyTasks.title')}</h1>
          <p className={styles.subtitle}>{t('dailyTasks.subtitle')}</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <PlusIcon width="18" height="18" />
          <span>{t('dailyTasks.newTask')}</span>
        </button>
      </header>

      {totalCount > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
          </div>
          <span className={styles.progressText}>{completedCount}/{totalCount} {t('dailyTasks.completed')}</span>
        </div>
      )}

      {sortedTasks.length > 0 ? (
        <div className={styles.taskList}>
          {sortedTasks.map((task) => {
            const priority = PRIORITIES.find((p) => p.value === task.priority)
            return (
              <div key={task.id} className={`${styles.taskItem} ${task.completed ? styles.taskCompleted : ''}`}>
                <button className={styles.taskCheck} onClick={() => handleToggle(task)}>
                  {task.completed ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  )}
                </button>
                <div className={styles.taskContent}>
                  <div className={styles.taskTitleRow}>
                    <span className={`${styles.taskTitle} ${task.completed ? styles.taskTitleDone : ''}`}>{task.title}</span>
                    <span className={styles.priorityBadge} style={{ color: priority?.color, background: priority?.color + '15' }}>
                      {priority?.emoji} {isAr ? priority?.labelAr : priority?.labelEn}
                    </span>
                  </div>
                  {task.time && <span className={styles.taskTime}>🕐 {formatTime12(task.time)}</span>}
                </div>
                <div className={styles.taskActions}>
                  <button className={styles.taskEditBtn} onClick={() => openEdit(task)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button className={styles.taskDeleteBtn} onClick={() => setShowDeleteConfirm(task.id)}>
                    <CloseIcon width="14" height="14" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('dailyTasks.noTasks')}</p>
          <p className={styles.emptyHint}>{t('dailyTasks.noTasksHint')}</p>
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editTask ? t('dailyTasks.editTask') : t('dailyTasks.newTask')}</h2>
              <button className={styles.modalClose} onClick={() => { setShowModal(false); resetForm() }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('dailyTasks.taskTitle')}</label>
                <input className={styles.fieldInput} type="text" placeholder="e.g. Review emails" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('dailyTasks.time')}</label>
                <input className={styles.fieldInput} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('dailyTasks.priority')}</label>
                <div className={styles.priorityGrid}>
                  {PRIORITIES.map((p) => {
                    const active = form.priority === p.value
                    return (
                      <button
                        key={p.value}
                        type="button"
                        className={`${styles.priorityBtn} ${active ? styles.priorityActive : ''}`}
                        style={active ? { borderColor: p.color, background: p.color + '15' } : {}}
                        onClick={() => setForm({ ...form, priority: p.value })}
                      >
                        <span>{p.emoji}</span>
                        <span>{isAr ? p.labelAr : p.labelEn}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm() }}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave}>{editTask ? t('common.update') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!showDeleteConfirm}
        title={t('dailyTasks.deleteTask')}
        message={t('dailyTasks.deleteTaskMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}
