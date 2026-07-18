'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { PlusIcon, CloseIcon } from '@/components/Icons'
import { subscribeToProjects, createProject, updateProject, deleteProject } from '@/services/projectsService'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AnimatedNumber from '@/components/features/AnimatedNumber'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './page.module.css'

export default function ProjectsPage() {
  const { user } = useUser()
  const { t } = useTranslation()
  const [projects, setProjects] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [form, setForm] = useState({ name: '', deadline: '', progress: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [editingProgress, setEditingProgress] = useState(null)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToProjects(user.uid, setProjects)
    return () => unsub()
  }, [user])

  const resetForm = () => setForm({ name: '', deadline: '', progress: 0 })

  const openAdd = () => {
    setEditProject(null)
    resetForm()
    setShowModal(true)
  }

  const openEdit = (project) => {
    setEditProject(project)
    setForm({
      name: project.name,
      deadline: project.deadline || '',
      progress: project.progress || 0,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !user) return
    try {
      const data = {
        name: form.name,
        deadline: form.deadline,
        progress: parseInt(form.progress) || 0,
        status: parseInt(form.progress) >= 100 ? 'completed' : 'active',
      }
      if (editProject) {
        await updateProject(user.uid, editProject.id, data)
      } else {
        await createProject(user.uid, data)
      }
      setShowModal(false)
      resetForm()
    } catch (err) {
      console.error('Failed to save project', err)
    }
  }

  const handleDelete = async () => {
    if (!user || !showDeleteConfirm) return
    try {
      await deleteProject(user.uid, showDeleteConfirm)
      setShowDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete project', err)
    }
  }

  const handleProgressUpdate = async (project, newProgress) => {
    if (!user) return
    try {
      const clamped = Math.min(Math.max(parseInt(newProgress) || 0, 0), 100)
      await updateProject(user.uid, project.id, {
        progress: clamped,
        status: clamped >= 100 ? 'completed' : 'active',
      })
      setEditingProgress(null)
    } catch (err) {
      console.error('Failed to update progress', err)
    }
  }

  const getDaysLeft = (deadline) => {
    if (!deadline) return null
    return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24))
  }

  const isOverdue = (project) => {
    if (!project.deadline || project.status === 'completed') return false
    return new Date(project.deadline) < new Date()
  }

  const activeProjects = projects.filter((p) => p.status !== 'completed')
  const completedProjects = projects.filter((p) => p.status === 'completed')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('projects.title')}</h1>
          <p className={styles.subtitle}>{t('projects.subtitle')}</p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>
          <PlusIcon width="18" height="18" />
          <span>{t('projects.newProject')}</span>
        </button>
      </header>

      {activeProjects.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('projects.activeProjects')}</h2>
          <div className={styles.grid}>
            {activeProjects.map((project) => {
              const daysLeft = getDaysLeft(project.deadline)
              const overdue = isOverdue(project)
              return (
                <div key={project.id} className={`${styles.projectCard} ${overdue ? styles.projectOverdue : ''}`}>
                  <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(project.id) }}>
                    <CloseIcon width="14" height="14" />
                  </button>
                  <h3 className={styles.projectName}>{project.name}</h3>
                  {project.deadline && (
                    <div className={`${styles.projectDeadline} ${overdue ? styles.deadlineOverdue : ''}`}>
                      {overdue ? t('projects.overdue') : `${daysLeft} ${t('projects.daysLeft')}`}
                    </div>
                  )}
                  <div className={styles.projectProgress}>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${project.progress || 0}%` }} />
                    </div>
                    <span className={styles.progressPct}>{project.progress || 0}%</span>
                  </div>
                  <div className={styles.projectActions}>
                    <button className={styles.editBtn} onClick={() => openEdit(project)}>{t('edit')}</button>
                    <button className={styles.progressBtn} onClick={() => setEditingProgress(project)}>
                      {t('projects.updateProgress')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {completedProjects.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('projects.completedProjects')}</h2>
          <div className={styles.grid}>
            {completedProjects.map((project) => (
              <div key={project.id} className={`${styles.projectCard} ${styles.projectCompleted}`}>
                <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(project.id) }}>
                  <CloseIcon width="14" height="14" />
                </button>
                <h3 className={styles.projectName}>{project.name}</h3>
                <div className={styles.projectProgress}>
                  <div className={styles.progressTrack}>
                    <div className={`${styles.progressFill} ${styles.progressComplete}`} style={{ width: '100%' }} />
                  </div>
                  <span className={styles.progressPct}>100%</span>
                </div>
                <div className={styles.projectActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(project)}>{t('edit')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {projects.length === 0 && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className={styles.emptyText}>{t('projects.noProjects')}</p>
          <p className={styles.emptyHint}>{t('projects.noProjectsHint')}</p>
        </div>
      )}

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editProject ? t('projects.editProject') : t('projects.newProject')}</h2>
              <button className={styles.modalClose} onClick={() => { setShowModal(false); resetForm() }}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('projects.projectName')}</label>
                <input className={styles.fieldInput} type="text" placeholder="e.g. Mobile App" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('projects.deadline')}</label>
                <input className={styles.fieldInput} type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('projects.progress')} (%)</label>
                <input className={styles.fieldInput} type="number" min="0" max="100" placeholder="0" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowModal(false); resetForm() }}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave}>{editProject ? t('common.update') : t('common.create')}</button>
            </div>
          </div>
        </div>
      )}

      {editingProgress && (
        <div className={styles.overlay} onClick={() => setEditingProgress(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t('projects.updateProgress')} - {editingProgress.name}</h2>
              <button className={styles.modalClose} onClick={() => setEditingProgress(null)}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{t('projects.progress')} (%)</label>
                <input className={styles.fieldInput} type="number" min="0" max="100" placeholder="0" defaultValue={editingProgress.progress || 0} autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleProgressUpdate(editingProgress, e.target.value) }} />
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditingProgress(null)}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={() => {
                const input = document.querySelector(`.${styles.modalBody} input[type="number"]`)
                handleProgressUpdate(editingProgress, input?.value || 0)
              }}>{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!showDeleteConfirm}
        title={t('projects.deleteProject')}
        message={t('projects.deleteProjectMsg')}
        confirmLabel={t('delete')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(null)}
      />
    </div>
  )
}
