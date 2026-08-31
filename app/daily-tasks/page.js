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
  { value: 'urgent', labelEn: 'Urgent', labelAr: 'عاجل', color: '#EF4444', emoji: '🔴' },
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
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  if (isAr) {
    return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function TasksPage() {
  const { user, lang } = useUser()
  const { t } = useTranslation()
  const isAr = lang === 'ar'

  const [allTasks, setAllTasks] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all') // 'all' | 'today' | 'tomorrow' | 'thisWeek' | 'overdue' | 'custom'
  const [customDate, setCustomDate] = useState(toDateStr(new Date()))
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'pending' | 'completed'
  const [priorityFilter, setPriorityFilter] = useState('all') // 'all' | 'urgent' | 'important' | 'normal'
  const [viewMode, setViewMode] = useState('list') // 'list' | 'day'
  const [selectedDayDate, setSelectedDayDate] = useState(toDateStr(new Date()))

  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [form, setForm] = useState({ title: '', date: '', time: '', priority: 'normal' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  const today = toDateStr(new Date())
  const tomorrow = toDateStr(new Date(Date.now() + 86400000))
  const currentWeekDates = useMemo(() => getWeekDates(today), [today])
  const dayStripWeekDates = useMemo(() => getWeekDates(selectedDayDate), [selectedDayDate])

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToDailyTasks(user.uid, (list) => {
      setAllTasks(list)
    })
    return () => unsub()
  }, [user])

  // Stats calculation
  const totalCount = allTasks.length
  const completedCount = allTasks.filter((t) => t.completed).length
  const todayTasks = allTasks.filter((t) => t.date === today)
  const todayCompletedCount = todayTasks.filter((t) => t.completed).length
  const overdueTasks = allTasks.filter((t) => !t.completed && t.date < today)
  const overdueCount = overdueTasks.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase()
        if (!task.title?.toLowerCase().includes(query)) {
          return false
        }
      }

      // Date filter
      if (viewMode === 'day') {
        if (task.date !== selectedDayDate) return false
      } else {
        if (dateFilter === 'today') {
          if (task.date !== today) return false
        } else if (dateFilter === 'tomorrow') {
          if (task.date !== tomorrow) return false
        } else if (dateFilter === 'thisWeek') {
          if (!currentWeekDates.includes(task.date)) return false
        } else if (dateFilter === 'overdue') {
          if (!(!task.completed && task.date < today)) return false
        } else if (dateFilter === 'custom') {
          if (task.date !== customDate) return false
        }
      }

      // Status filter
      if (statusFilter === 'pending' && task.completed) return false
      if (statusFilter === 'completed' && !task.completed) return false

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false

      return true
    }).sort((a, b) => {
      // Completed at bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1

      // Sort by date (closer date first)
      if (a.date !== b.date) {
        return (a.date || '').localeCompare(b.date || '')
      }

      // Priority order
      const pOrder = { urgent: 0, important: 1, normal: 2 }
      return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
    })
  }, [allTasks, searchQuery, dateFilter, customDate, statusFilter, priorityFilter, viewMode, selectedDayDate, today, tomorrow, currentWeekDates])

  // Grouped tasks by date for day strip
  const tasksByDate = useMemo(() => {
    const map = {}
    allTasks.forEach((task) => {
      if (!map[task.date]) map[task.date] = []
      map[task.date].push(task)
    })
    return map
  }, [allTasks])

  const resetForm = () => {
    const defaultDate = dateFilter === 'custom' ? customDate : dateFilter === 'tomorrow' ? tomorrow : today
    setForm({ title: '', date: defaultDate, time: '', priority: 'normal' })
  }

  const openAdd = () => {
    setEditTask(null)
    const defaultDate = viewMode === 'day' ? selectedDayDate : dateFilter === 'custom' ? customDate : dateFilter === 'tomorrow' ? tomorrow : today
    setForm({ title: '', date: defaultDate, time: '', priority: 'normal' })
    setShowModal(true)
  }

  const openEdit = (task) => {
    setEditTask(task)
    setForm({
      title: task.title,
      date: task.date || today,
      time: task.time || '',
      priority: task.priority || 'normal',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.date || !user) return
    try {
      if (editTask) {
        await updateDailyTask(user.uid, editTask.id, {
          title: form.title.trim(),
          date: form.date,
          time: form.time,
          priority: form.priority,
        })
      } else {
        await createDailyTask(user.uid, {
          title: form.title.trim(),
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

  const clearAllFilters = () => {
    setSearchQuery('')
    setDateFilter('all')
    setStatusFilter('all')
    setPriorityFilter('all')
  }

  const isAnyFilterActive = searchQuery !== '' || dateFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all'

  const navigateDay = (offset) => {
    const d = new Date(selectedDayDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    setSelectedDayDate(toDateStr(d))
  }

  const renderDateBadge = (task) => {
    const isOverdue = !task.completed && task.date < today
    if (task.date === today) {
      return <span className={`${styles.taskDateBadge} ${styles.taskDateBadgeToday}`}>📅 {t('dailyTasks.today')}</span>
    }
    if (task.date === tomorrow) {
      return <span className={`${styles.taskDateBadge} ${styles.taskDateBadgeTomorrow}`}>📅 {t('dailyTasks.tomorrow')}</span>
    }
    if (isOverdue) {
      return (
        <span className={`${styles.taskDateBadge} ${styles.taskDateBadgeOverdue}`}>
          ⚠️ {formatDateShort(task.date, isAr)}
        </span>
      )
    }
    return <span className={styles.taskDateBadge}>📅 {formatDateShort(task.date, isAr)}</span>
  }

  return (
    <div className={styles.page}>
      {/* Header */}
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

      {/* Stats Overview */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>📋</div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{totalCount}</span>
            <span className={styles.statLabel}>{t('dailyTasks.statsTotal')}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconToday}`}>☀️</div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {todayCompletedCount}/{todayTasks.length}
            </span>
            <span className={styles.statLabel}>{t('dailyTasks.statsToday')}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCompleted}`}>✅</div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>
              {completedCount} <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-gray)' }}>({completionPct}%)</span>
            </span>
            <span className={styles.statLabel}>{t('dailyTasks.statsCompleted')}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconOverdue}`}>⏳</div>
          <div className={styles.statContent}>
            <span className={styles.statValue} style={{ color: overdueCount > 0 ? 'var(--danger)' : 'inherit' }}>
              {overdueCount}
            </span>
            <span className={styles.statLabel}>{t('dailyTasks.statsOverdue')}</span>
          </div>
        </div>
      </div>

      {/* Controls & Filters Section */}
      <div className={styles.controlsSection}>
        {/* Search Row & View Toggle */}
        <div className={styles.searchRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('dailyTasks.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>

          <div className={styles.viewModeToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('list')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>{t('dailyTasks.listView')}</span>
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'day' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('day')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{t('dailyTasks.dayView')}</span>
            </button>
          </div>
        </div>

        {/* Filter Row */}
        {viewMode === 'list' && (
          <div className={styles.filterRow}>
            {/* Date filter pills */}
            <div className={styles.datePillsGroup}>
              <button
                className={`${styles.pillBtn} ${dateFilter === 'all' ? styles.pillBtnActive : ''}`}
                onClick={() => setDateFilter('all')}
              >
                <span>{t('dailyTasks.filterAll')}</span>
                <span className={styles.pillBadge}>{totalCount}</span>
              </button>

              <button
                className={`${styles.pillBtn} ${dateFilter === 'today' ? styles.pillBtnActive : ''}`}
                onClick={() => setDateFilter('today')}
              >
                <span>{t('dailyTasks.filterToday')}</span>
                {todayTasks.length > 0 && <span className={styles.pillBadge}>{todayTasks.length}</span>}
              </button>

              <button
                className={`${styles.pillBtn} ${dateFilter === 'tomorrow' ? styles.pillBtnActive : ''}`}
                onClick={() => setDateFilter('tomorrow')}
              >
                <span>{t('dailyTasks.filterTomorrow')}</span>
              </button>

              <button
                className={`${styles.pillBtn} ${dateFilter === 'thisWeek' ? styles.pillBtnActive : ''}`}
                onClick={() => setDateFilter('thisWeek')}
              >
                <span>{t('dailyTasks.filterThisWeek')}</span>
              </button>

              <button
                className={`${styles.pillBtn} ${dateFilter === 'overdue' ? styles.pillBtnActive : ''}`}
                onClick={() => setDateFilter('overdue')}
              >
                <span>{t('dailyTasks.filterOverdue')}</span>
                {overdueCount > 0 && (
                  <span className={styles.pillBadge} style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#EF4444' }}>
                    {overdueCount}
                  </span>
                )}
              </button>

              {/* Specific Date Picker Input */}
              <div className={`${styles.customDateInputWrap} ${dateFilter === 'custom' ? styles.pillBtnActive : ''}`}>
                <span>📅</span>
                <input
                  type="date"
                  className={styles.customDateInput}
                  value={customDate}
                  onChange={(e) => {
                    setCustomDate(e.target.value)
                    setDateFilter('custom')
                  }}
                  title={t('dailyTasks.pickCustomDate')}
                />
              </div>
            </div>

            {/* Secondary filters (Status, Priority, Reset) */}
            <div className={styles.secondaryFilters}>
              <select
                className={styles.selectFilter}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t('dailyTasks.statusAll')}</option>
                <option value="pending">{t('dailyTasks.statusPending')}</option>
                <option value="completed">{t('dailyTasks.statusCompleted')}</option>
              </select>

              <select
                className={styles.selectFilter}
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="all">{t('dailyTasks.priority')}: {t('dailyTasks.all')}</option>
                <option value="urgent">🔴 {t('dailyTasks.urgent')}</option>
                <option value="important">🟡 {t('dailyTasks.important')}</option>
                <option value="normal">🟢 {t('dailyTasks.normal')}</option>
              </select>

              {isAnyFilterActive && (
                <button className={styles.resetFilterBtn} onClick={clearAllFilters} title={t('dailyTasks.clearFilter')}>
                  <CloseIcon width="16" height="16" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Day Mode Navigation Strip */}
      {viewMode === 'day' && (
        <>
          <div className={styles.dateHeader}>
            <div className={styles.dateNav}>
              <button className={styles.dateNavBtn} onClick={() => navigateDay(-1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className={styles.dateInfo}>
                <span className={styles.dateMonth}>{formatDateShort(selectedDayDate, isAr)}</span>
                {selectedDayDate === today && <span className={styles.todayBadge}>{t('dailyTasks.today')}</span>}
              </div>
              <button className={styles.dateNavBtn} onClick={() => navigateDay(1)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.dateStrip}>
            {dayStripWeekDates.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00')
              const isSelected = dateStr === selectedDayDate
              const isDateToday = dateStr === today
              const dayTasksList = tasksByDate[dateStr] || []
              const hasTasks = dayTasksList.length > 0
              const allDone = hasTasks && dayTasksList.every((t) => t.completed)
              return (
                <button
                  key={dateStr}
                  className={`${styles.stripDay} ${isSelected ? styles.stripDaySelected : ''} ${isDateToday ? styles.stripDayToday : ''}`}
                  onClick={() => setSelectedDayDate(dateStr)}
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
        </>
      )}

      {/* Progress Bar for Current View */}
      {filteredTasks.length > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.round((filteredTasks.filter((t) => t.completed).length / filteredTasks.length) * 100)}%`,
              }}
            />
          </div>
          <span className={styles.progressText}>
            {filteredTasks.filter((t) => t.completed).length}/{filteredTasks.length} {t('dailyTasks.completed')}
          </span>
        </div>
      )}

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <div className={styles.taskList}>
          {filteredTasks.map((task) => {
            const priority = PRIORITIES.find((p) => p.value === task.priority)
            const isOverdue = !task.completed && task.date < today

            return (
              <div
                key={task.id}
                className={`${styles.taskItem} ${task.completed ? styles.taskCompleted : ''} ${isOverdue ? styles.taskOverdue : ''}`}
                onClick={() => handleToggle(task)}
              >
                <div className={styles.taskLeftSection}>
                  <div className={`${styles.taskIconBadge} ${task.completed ? styles.taskIconBadgeDone : ''}`}>
                    <span>{priority?.emoji || '📋'}</span>
                  </div>
                  <div className={styles.taskContent}>
                    <span className={`${styles.taskTitle} ${task.completed ? styles.taskTitleDone : ''}`}>
                      {task.title}
                    </span>
                    {(task.time || isOverdue) && (
                      <div className={styles.taskMeta}>
                        {task.time && (
                          <span className={styles.taskTime}>
                            🕐 {formatTime12(task.time)}
                          </span>
                        )}
                        {isOverdue && <span className={styles.overdueBadge}>{t('dailyTasks.overdue')}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.taskRightSection}>
                  <div
                    className={`${styles.taskCheck} ${task.completed ? styles.taskCheckDone : ''}`}
                    title={task.completed ? 'مكتمل' : 'غير مكتمل'}
                  >
                    {task.completed ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <div className={styles.emptyCircle} />
                    )}
                  </div>

                  <div className={styles.taskActions} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.taskEditBtn} onClick={() => openEdit(task)} title={t('edit')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button className={styles.taskDeleteBtn} onClick={() => setShowDeleteConfirm(task.id)} title={t('delete')}>
                      <CloseIcon width="14" height="14" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('dailyTasks.noTasksForDate')}</p>
          <p className={styles.emptyHint}>{t('dailyTasks.noTasksHintDate')}</p>
          {isAnyFilterActive && (
            <button className={styles.emptyResetBtn} onClick={clearAllFilters}>
              {t('dailyTasks.clearFilter')}
            </button>
          )}
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editTask ? t('dailyTasks.editTask') : t('dailyTasks.newTask')}
              </h2>
              <button className={styles.modalClose} onClick={() => { setShowModal(false); resetForm() }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('dailyTasks.taskTitle')}</label>
                <input
                  className={styles.fieldInput}
                  type="text"
                  placeholder={isAr ? 'مثال: مراجعة الفواتير والاشتراكات' : 'e.g. Review monthly budget and invoices'}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  autoFocus
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t('dailyTasks.date')}</label>
                  <input
                    className={styles.fieldInput}
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{t('dailyTasks.time')}</label>
                  <input
                    className={styles.fieldInput}
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.quickDates}>
                <button
                  type="button"
                  className={`${styles.quickDateBtn} ${form.date === today ? styles.quickDateActive : ''}`}
                  onClick={() => setForm({ ...form, date: today })}
                >
                  {t('dailyTasks.today')}
                </button>
                <button
                  type="button"
                  className={`${styles.quickDateBtn} ${form.date === tomorrow ? styles.quickDateActive : ''}`}
                  onClick={() => setForm({ ...form, date: tomorrow })}
                >
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
              <button className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm() }}>
                {t('cancel')}
              </button>
              <button className={styles.saveBtn} onClick={handleSave}>
                {editTask ? t('common.update') : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
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
