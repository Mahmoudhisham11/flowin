'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useTranslation } from '@/hooks/useTranslation'
import { getAllUsers, updateUserRole } from '@/services/adminService'
import { getPendingUpgrades, approveUpgrade, rejectUpgrade } from '@/services/pendingUpgradesService'
import { upgradeToPro } from '@/services/subscriptionService'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Select from '@/components/ui/Select'
import styles from './page.module.css'

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
]

const ROLE_FILTERS = ['all', 'free', 'pro', 'admin']
const METHOD_FILTERS = ['all', 'email', 'google']

export default function AdminPage() {
  const { userData } = useUser()
  const { t, lang, isAr } = useTranslation()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [updating, setUpdating] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmRole, setConfirmRole] = useState('')
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [upgradeId, setUpgradeId] = useState(null)
  const [upgradeAction, setUpgradeAction] = useState(null)
  const [tab, setTab] = useState('users')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (e) {
      console.error('Failed to fetch users:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const data = await getPendingUpgrades()
      setPending(data.filter((p) => p.status === 'pending'))
    } catch (e) {
      console.error('Failed to fetch pending upgrades:', e)
    } finally {
      setPendingLoading(false)
    }
  }, [])

  useEffect(() => {
    if (userData && userData.role !== 'admin') {
      router.replace('/')
      return
    }
    fetchUsers()
    fetchPending()
  }, [userData, router, fetchUsers, fetchPending])

  const filteredUsers = useMemo(() => {
    let result = [...users]
    const q = search.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.role && u.role.toLowerCase().includes(q))
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter)
    }
    if (methodFilter !== 'all') {
      const provider = methodFilter === 'google' ? 'google.com' : 'password'
      result = result.filter((u) => (u.signUpMethod || u.provider) === provider)
    }
    return result
  }, [users, search, roleFilter, methodFilter])

  const filteredPending = useMemo(() => {
    let result = [...pending]
    const q = search.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (p) =>
          (p.phone && p.phone.includes(q)) ||
          (p.refId && p.refId.toLowerCase().includes(q)) ||
          (p.email && p.email.toLowerCase().includes(q))
      )
    }
    return result
  }, [pending, search])

  const userNames = useMemo(() => {
    const names = {}
    users.forEach((u) => { names[u.id] = u.name || u.email || u.id })
    return names
  }, [users])

  const handleEditClick = (user) => {
    setEditingId(user.id)
    setEditRole(user.role || 'free')
  }

  const handleRoleChange = (val) => {
    setEditRole(val)
  }

  const handleSave = () => {
    setConfirmId(editingId)
    setConfirmRole(editRole)
  }

  const confirmSave = async () => {
    if (!confirmId || !confirmRole) return
    setUpdating(true)
    try {
      await updateUserRole(confirmId, confirmRole)
      setUsers((prev) =>
        prev.map((u) => (u.id === confirmId ? { ...u, role: confirmRole } : u))
      )
      setEditingId(null)
      setEditRole('')
    } catch (e) {
      console.error('Failed to update role:', e)
    } finally {
      setUpdating(false)
      setConfirmId(null)
      setConfirmRole('')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditRole('')
  }

  const handleUpgrade = (docId, uid, action) => {
    setUpgradeId(docId)
    setUpgradeAction(action)
  }

  const confirmUpgrade = async () => {
    if (!upgradeId) return
    try {
      if (upgradeAction === 'approve') {
        const req = pending.find((p) => p.id === upgradeId)
        if (req?.uid) await upgradeToPro(req.uid)
        await approveUpgrade(upgradeId)
      } else {
        await rejectUpgrade(upgradeId)
      }
      setPending((prev) => prev.filter((p) => p.id !== upgradeId))
    } catch (e) {
      console.error('Failed to process upgrade:', e)
    } finally {
      setUpgradeId(null)
      setUpgradeAction(null)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const getInitials = (name, email) => {
    const s = name || email || 'U'
    return s.slice(0, 2).toUpperCase()
  }

  if (!userData) return null
  if (userData.role !== 'admin') return null

  const admins = users.filter((u) => u.role === 'admin').length
  const free = users.filter((u) => u.role === 'free').length
  const pro = users.filter((u) => u.role === 'pro').length

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('admin.title')}</h1>
          <p className={styles.subtitle}>{t('admin.subtitle')}</p>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{users.length}</span>
          <span className={styles.statLabel}>{t('admin.totalUsers')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{admins}</span>
          <span className={styles.statLabel}>{t('admin.admins')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{free}</span>
          <span className={styles.statLabel}>{t('admin.free')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{pro}</span>
          <span className={styles.statLabel}>{t('admin.pro')}</span>
        </div>
      </div>

      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === 'users' ? styles.tabActive : ''}`}
          onClick={() => setTab('users')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {t('admin.users')}
          {users.length > 0 && <span className={styles.tabCount}>{users.length}</span>}
        </button>
        <button
          className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
          onClick={() => setTab('pending')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          {t('admin.pendingUpgrades')}
          {pending.length > 0 && <span className={styles.tabCount}>{pending.length}</span>}
        </button>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className={styles.searchInput}
            type="text"
            placeholder={`${t('admin.search')}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {tab === 'users' && (
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f}
                  className={`${styles.filterPill} ${roleFilter === f ? styles.filterActive : ''}`}
                  onClick={() => setRoleFilter(f)}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className={styles.filterGroup}>
              {METHOD_FILTERS.map((f) => (
                <button
                  key={f}
                  className={`${styles.filterPill} ${styles.methodPill} ${methodFilter === f ? styles.filterActive : ''}`}
                  onClick={() => setMethodFilter(f)}
                >
                  {f === 'all' ? 'All' : f === 'google' ? 'Google' : 'Email'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {tab === 'users' ? (
        <div className={styles.cardList}>
          {loading ? (
            <div className={styles.loading}>{t('loading')}</div>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.empty}>{users.length === 0 ? t('admin.noUsers') : t('admin.noResults')}</div>
          ) : (
            filteredUsers.map((u) => (
              <div key={u.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.cardAvatar}>{getInitials(u.name, u.email)}</div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>{u.name || '-'}</div>
                    <div className={styles.cardEmail}>{u.email || '-'}</div>
                    <div className={styles.cardMeta}>
                      <span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>
                        {u.role || 'free'}
                      </span>
                      <span className={styles.methodBadge}>
                        {(u.signUpMethod || u.provider) === 'google.com' ? 'Google' : 'Email'}
                      </span>
                      <span className={styles.dateText}>{formatDate(u.createdAt).split(',').slice(0,2).join(',')}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  {editingId === u.id ? (
                    <div className={styles.editPopover}>
                      <Select
                        options={roleOptions}
                        value={editRole}
                        onChange={handleRoleChange}
                      />
                      <div className={styles.editActions}>
                        <button className={styles.saveBtn} onClick={handleSave} disabled={updating}>
                          {updating ? t('saving') : t('save')}
                        </button>
                        <button className={styles.cancelBtn} onClick={handleCancel}>
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className={styles.editBtn} onClick={() => handleEditClick(u)}>
                      {t('edit')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.cardList}>
          {pendingLoading ? (
            <div className={styles.loading}>{t('loading')}</div>
          ) : filteredPending.length === 0 ? (
            <div className={styles.empty}>{pending.length === 0 ? t('admin.noPending') : t('admin.noResults')}</div>
          ) : (
            filteredPending.map((p) => (
              <div key={p.id} className={styles.card}>
                <div className={styles.cardMain}>
                  <div className={styles.cardAvatar}>{getInitials(userNames[p.uid] || p.email, p.email)}</div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardName}>{userNames[p.uid] || p.email || p.uid}</div>
                    <div className={styles.cardMeta}>
                      <span className={styles.refBadge}>{p.refId}</span>
                      <span className={styles.dateText}>{p.phone}</span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.upgradeAmount}>{p.amount} $</span>
                      <span className={styles.dateText}>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.approveBtn} onClick={() => handleUpgrade(p.id, p.uid, 'approve')}>
                    {t('admin.approve')}
                  </button>
                  <button className={styles.rejectBtn} onClick={() => handleUpgrade(p.id, p.uid, 'reject')}>
                    {t('admin.reject')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {confirmId && (
        <ConfirmDialog
          title={t('admin.editRole')}
          message={`${t('admin.editRole')} ${t('common.to')} "${confirmRole}"?`}
          confirmLabel={t('save')}
          cancelLabel={t('cancel')}
          onConfirm={confirmSave}
          onCancel={() => { setConfirmId(null); setConfirmRole('') }}
        />
      )}

      {upgradeId && (
        <ConfirmDialog
          title={t('admin.pendingUpgrades')}
          message={`${upgradeAction === 'approve' ? t('admin.approveConfirm') : t('admin.rejectConfirm')} ${userNames[pending.find((p) => p.id === upgradeId)?.uid] || ''}?`}
          confirmLabel={upgradeAction === 'approve' ? t('admin.approve') : t('admin.reject')}
          cancelLabel={t('cancel')}
          onConfirm={confirmUpgrade}
          onCancel={() => { setUpgradeId(null); setUpgradeAction(null) }}
        />
      )}
    </div>
  )
}