'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon } from '@/components/Icons'
import {
  subscribeToDailyTasks,
  createDailyTask,
  toggleDailyTask,
  updateDailyTask,
  deleteDailyTask,
} from '@/services/dailyTasksService'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

const PRIORITIES = [
  { value: 'urgent', labelEn: 'Urgent', labelAr: 'مستعجل', color: '#EF4444', emoji: '🔴' },
  { value: 'important', labelEn: 'Important', labelAr: 'مهم', color: '#F59E0B', emoji: '🟡' },
  { value: 'normal', labelEn: 'Normal', labelAr: 'عادي', color: '#22C55E', emoji: '🟢' },
]

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function toDateStr(d) {
  return d.toISOString().split('T')[0]
}

function formatTime12(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${hour12}:${m} ${ampm}`
}

function getWeekDates(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    dates.push(toDateStr(dt))
  }
  return dates
}

function formatDateShort(dateStr, isAr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isAr) {
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr, isAr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isAr) {
    return d.toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function DailyTasksPage() {
  const { user, lang } = useUser()
  const { t } = useTranslation()
  const [allTasks, setAllTasks] = useState([])
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [viewMode, setViewMode] = useState('day')
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm] = useState({ title: '', date: '', time: '', priority: 'normal' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const isAr = lang === 'ar'
  const today = toDateStr(new Date())

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToDailyTasks(user.uid, setAllTasks)
    return () => unsub()
  }, [user])

  const resetForm = () => setForm({ title: '', date: selectedDate, time: '', priority: 'normal' })

  const openAdd = () => {
    setEditTask(null)
    setForm({ title: '', date: selectedDate, time: '', priority: 'normal' })
    setShowModal(true)
  }

  const openEdit = (task) => {
    setEditTask(task)
    setForm({ title: task.title, date: task.date, time: task.time || '', priority: task.priority || 'normal' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title || !form.date || !user) return
    try {
      if (editTask) {
        await updateDailyTask(user.uid, editTask.id, {
          title: form.title,
          date: form.date,
          time: form.time,
          priority: form.priority,
        })
      } else {
        await createDailyTask(user.uid, {
          title: form.title,
          date: form.date,
          time: form.time,
          priority: form.priority,
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

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate])

  const tasksByDate = useMemo(() => {
    const map = {}
    allTasks.forEach((task) => {
      if (!map[task.date]) map[task.date] = []
      map[task.date].push(task)
    })
    Object.keys(map).forEach((date) => {
      map[date].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        const pOrder = { urgent: 0, important: 1, normal: 2 }
        return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
      })
    })
    return map
  }, [allTasks])

  const selectedDateTasks = tasksByDate[selectedDate] || []
  const completedCount = selectedDateTasks.filter((t) => t.completed).length
  const totalCount = selectedDateTasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const isToday = selectedDate === today

  const navigateDay = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDate(toDateStr(d))
  }

  const navigateWeek = (offset) => {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset * 7)
    setSelectedDate(toDateStr(d))
  }

  const getRelativeLabel = (dateStr) => {
    if (dateStr === today) return t('dailyTasks.today')
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (dateStr === toDateStr(tomorrow)) return t('dailyTasks.tomorrow')
    return formatDateShort(dateStr, isAr)
  }

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

      <div className={styles.dateHeader}>
        <div className={styles.dateNav}>
          <button className={styles.dateNavBtn} onClick={() => viewMode === 'day' ? navigateDay(-1) : navigateWeek(-1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className={styles.dateInfo}>
            <span className={styles.dateMonth}>{formatDateShort(selectedDate, isAr)}</span>
            {isToday && <span className={styles.todayBadge}>{t('dailyTasks.today')}</span>}
          </div>
          <button className={styles.dateNavBtn} onClick={() => viewMode === 'day' ? navigateDay(1) : navigateWeek(1)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${viewMode === 'day' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('day')}>
            {t('dailyTasks.dayView')}
          </button>
          <button className={`${styles.viewBtn} ${viewMode === 'week' ? styles.viewBtnActive : ''}`} onClick={() => setViewMode('week')}>
            {t('dailyTasks.weekView')}
          </button>
        </div>
      </div>

      <div className={styles.dateStrip}>
        {weekDates.map((dateStr) => {
          const d = new Date(dateStr + 'T00:00:00')
          const isSelected = dateStr === selectedDate
          const isDateToday = dateStr === today
          const hasTasks = (tasksByDate[dateStr] || []).length > 0
          const dayTasks = tasksByDate[dateStr] || []
          const allDone = dayTasks.length > 0 && dayTasks.every((t) => t.completed)
          return (
            <button
              key={dateStr}
              className={`${styles.stripDay} ${isSelected ? styles.stripDaySelected : ''} ${isDateToday ? styles.stripDayToday : ''}`}
              onClick={() => { setSelectedDate(dateStr); setViewMode('day') }}
            >
              <span className={styles.stripDayName}>{t(`dailyTasks.${DAY_NAMES[d.getDay()]}`)}</span>
              <span className={styles.stripDayNum}>{d.getDate()}</span>
              {hasTasks && (
                <span className={`${styles.stripDayDot} ${allDone ? styles.stripDayDotDone : ''}`} />
              )}
            </button>
          )
        })}
      </div>

      {totalCount > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${completionPct}%` }} />
          </div>
          <span className={styles.progressText}>{completedCount}/{totalCount} {t('dailyTasks.completed')}</span>
        </div>
      )}

      {viewMode === 'day' ? (
        selectedDateTasks.length > 0 ? (
          <div className={styles.taskList}>
            {selectedDateTasks.map((task) => {
              const priority = PRIORITIES.find((p) => p.value === task.priority)
              const isOverdue = !task.completed && task.date < today
              return (
                <div key={task.id} className={`${styles.taskItem} ${task.completed ? styles.taskCompleted : ''} ${isOverdue ? styles.taskOverdue : ''}`}>
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
                    <div className={styles.taskMeta}>
                      {task.time && <span className={styles.taskTime}>🕐 {formatTime12(task.time)}</span>}
                      {isOverdue && <span className={styles.overdueBadge}>{t('dailyTasks.overdue')}</span>}
                    </div>
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
            <p className={styles.emptyText}>{t('dailyTasks.noTasksForDate')}</p>
            <p className={styles.emptyHint}>{t('dailyTasks.noTasksHintDate')}</p>
          </div>
        )
      ) : (
        <div className={styles.weekView}>
          {weekDates.map((dateStr) => {
            const dayTasks = tasksByDate[dateStr] || []
            const d = new Date(dateStr + 'T00:00:00')
            const isDateToday = dateStr === today
            const isSelected = dateStr === selectedDate
            return (
              <div key={dateStr} className={`${styles.weekDay} ${isSelected ? styles.weekDaySelected : ''}`}>
                <div className={styles.weekDayHeader}>
                  <span className={styles.weekDayName}>{t(`dailyTasks.${DAY_NAMES[d.getDay()]}`)}</span>
                  <span className={`${styles.weekDayDate} ${isDateToday ? styles.weekDayDateToday : ''}`}>{d.getDate()}</span>
                  {dayTasks.length > 0 && (
                    <span className={styles.weekDayCount}>{dayTasks.filter((t) => t.completed).length}/{dayTasks.length}</span>
                  )}
                </div>
                {dayTasks.length > 0 ? (
                  <div className={styles.weekDayTasks}>
                    {dayTasks.slice(0, 3).map((task) => {
                      const priority = PRIORITIES.find((p) => p.value === task.priority)
                      return (
                        <div key={task.id} className={`${styles.weekTaskItem} ${task.completed ? styles.weekTaskDone : ''}`}>
                          <span className={styles.weekTaskDot} style={{ background: priority?.color || '#22C55E' }} />
                          <span className={styles.weekTaskTitle}>{task.title}</span>
                          {task.time && <span className={styles.weekTaskTime}>{formatTime12(task.time)}</span>}
                        </div>
                      )
                    })}
                    {dayTasks.length > 3 && (
                      <span className={styles.weekMore}>+{dayTasks.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.weekDayEmpty}>—</div>
                )}
              </div>
            )
          })}
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
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t('dailyTasks.date')}</label>
                  <input className={styles.fieldInput} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t('dailyTasks.time')}</label>
                  <input className={styles.fieldInput} type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div className={styles.quickDates}>
                <button className={`${styles.quickDateBtn} ${form.date === today ? styles.quickDateActive : ''}`} onClick={() => setForm({ ...form, date: today })}>
                  {t('dailyTasks.today')}
                </button>
                <button className={`${styles.quickDateBtn} ${form.date === toDateStr(new Date(Date.now() + 86400000)) ? styles.quickDateActive : ''}`} onClick={() => setForm({ ...form, date: toDateStr(new Date(Date.now() + 86400000)) })}>
                  {t('dailyTasks.tomorrow')}
                </button>
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
