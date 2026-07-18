'use client'

import { useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLocale } from '@/contexts/LocaleContext'
import { changePassword } from '@/services/firebaseAuth'
import { t } from '@/lib/translations'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import PricingModal from '@/components/subscription/PricingModal'
import styles from './page.module.css'

const THEME_OPTIONS = [
  { value: 'light', labelEn: 'Light', labelAr: 'فاتح', icon: '☀️' },
  { value: 'dark', labelEn: 'Dark', labelAr: 'داكن', icon: '🌙' },
  { value: 'system', labelEn: 'System', labelAr: 'حسب النظام', icon: '💻' },
]

const LANG_OPTIONS = [
  { value: 'en', labelEn: 'English', labelAr: 'English', icon: '🇬🇧' },
  { value: 'ar', labelEn: 'العربية', labelAr: 'العربية', icon: '🇸🇦' },
]

export default function SettingsPage() {
  const { user, userData, logout } = useUser()
  const { theme, setTheme } = useTheme()
  const { lang, setLang } = useLocale()

  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' })
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showPricing, setShowPricing] = useState(false)

  const isAr = lang === 'ar'

  const displayName = userData?.name || user?.email?.split('@')[0] || 'User'
  const displayEmail = userData?.email || user?.email || ''
  const memberSince = userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' }) : ''

  const googleProvider = user?.providerData?.some((p) => p?.providerId === 'google.com')

  const handleChangePassword = async () => {
    setPwdError('')
    setPwdSuccess(false)

    if (!pwdForm.current || !pwdForm.newPwd || !pwdForm.confirm) {
      setPwdError(t('common.required'))
      return
    }
    if (pwdForm.newPwd.length < 6) {
      setPwdError(t('auth.weakPassword'))
      return
    }
    if (pwdForm.newPwd !== pwdForm.confirm) {
      setPwdError(t('auth.passwordsDontMatch'))
      return
    }

    setPwdLoading(true)
    try {
      await changePassword(pwdForm.current, pwdForm.newPwd)
      setPwdSuccess(true)
      setPwdForm({ current: '', newPwd: '', confirm: '' })
      setTimeout(() => { setShowPwdModal(false); setPwdSuccess(false) }, 1500)
    } catch (err) {
      const code = err?.code || ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setPwdError(t('auth.incorrectPassword'))
      } else {
        setPwdError(t('auth.passwordChangeError'))
      }
    } finally {
      setPwdLoading(false)
    }
  }

  const tTheme = (key) => {
    const opt = THEME_OPTIONS.find((o) => o.value === key)
    return isAr ? opt?.labelAr : opt?.labelEn
  }

  const tLang = (key) => LANG_OPTIONS.find((o) => o.value === key)?.labelEn || key

  const showBanner = userData?.role === 'free'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </header>

      {showBanner && (
        <div className={styles.banner}>
          <div className={styles.bannerContent}>
            <h2 className={styles.bannerTitle}>{t('subscription.bannerTitle')}</h2>
            <p className={styles.bannerDesc}>{t('subscription.bannerDesc')}</p>
          </div>
          <button className={styles.bannerBtn} onClick={() => setShowPricing(true)}>{t('subscription.subscribe')}</button>
        </div>
      )}

      <div className={styles.sectionGrid}>
        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h2 className={styles.sectionTitle}>{t('settings.profile')}</h2>
            </div>
            <div className={styles.profileRow}>
              <div className={styles.profileAvatar}>
                <span>{displayName[0]?.toUpperCase() || 'U'}</span>
              </div>
              <div className={styles.profileInfo}>
                <span className={styles.profileName}>{displayName}</span>
                <span className={styles.profileEmail}>{displayEmail}</span>
                <span className={styles.profileMeta}>{t('settings.memberSince')} {memberSince}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{t('auth.changePassword')}</h2>
                <p className={styles.sectionDesc}>{t('settings.managePassword')}</p>
              </div>
            </div>
            {googleProvider ? (
              <div className={styles.googleNotice}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>{isAr ? 'أنت مسجل الدخول عبر Google. لا يمكن تغيير كلمة المرور.' : 'You are signed in with Google. Password change is not available.'}</span>
              </div>
            ) : (
              <button className={styles.actionBtn} onClick={() => { setPwdError(''); setPwdSuccess(false); setPwdForm({ current: '', newPwd: '', confirm: '' }); setShowPwdModal(true) }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>{t('settings.changePwdDesc')}</span>
              </button>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{t('settings.appearance')}</h2>
                <p className={styles.sectionDesc}>{t('settings.themeDesc')}</p>
              </div>
            </div>
            <div className={styles.optionGroup}>
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.optionCard} ${theme === opt.value ? styles.optionActive : ''}`}
                  onClick={() => setTheme(opt.value)}
                >
                  <span className={styles.optionEmoji}>{opt.icon}</span>
                  <span className={styles.optionLabel}>{isAr ? opt.labelAr : opt.labelEn}</span>
                  {theme === opt.value && (
                    <svg className={styles.optionCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h2 className={styles.sectionTitle}>{t('settings.language')}</h2>
                <p className={styles.sectionDesc}>{t('settings.languageDesc')}</p>
              </div>
            </div>
            <div className={styles.optionGroup}>
              {LANG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.optionCard} ${lang === opt.value ? styles.optionActive : ''}`}
                  onClick={() => setLang(opt.value)}
                >
                  <span className={styles.optionEmoji}>{opt.icon}</span>
                  <span className={styles.optionLabel}>{opt.labelEn}</span>
                  {lang === opt.value && (
                    <svg className={styles.optionCheck} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.logoutSection}>
        <button className={styles.logoutBtn} onClick={() => setShowLogoutConfirm(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>{t('auth.logout')}</span>
        </button>
      </div>

      {showPwdModal && (
        <div className={styles.overlay} onClick={() => { if (!pwdLoading) setShowPwdModal(false) }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t('auth.changePassword')}</h2>
              <button className={styles.modalClose} onClick={() => { if (!pwdLoading) setShowPwdModal(false) }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {pwdSuccess ? (
                <div className={styles.successState}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p className={styles.successText}>{t('auth.passwordChanged')}</p>
                </div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{t('auth.currentPassword')}</label>
                    <input className={styles.fieldInput} type="password" placeholder="••••••••" value={pwdForm.current}
                      onChange={(e) => setPwdForm({ ...pwdForm, current: e.target.value })} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{t('auth.newPassword')}</label>
                    <input className={styles.fieldInput} type="password" placeholder="••••••••" value={pwdForm.newPwd}
                      onChange={(e) => setPwdForm({ ...pwdForm, newPwd: e.target.value })} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{t('auth.confirmPassword')}</label>
                    <input className={styles.fieldInput} type="password" placeholder="••••••••" value={pwdForm.confirm}
                      onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })} />
                  </div>
                  {pwdError && <p className={styles.errorText}>{pwdError}</p>}
                  <button className={styles.saveBtn} onClick={handleChangePassword} disabled={pwdLoading}>
                    {pwdLoading ? t('saving') : t('save')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showLogoutConfirm}
        title={t('auth.logout')}
        message={t('auth.logoutConfirm')}
        confirmLabel={t('auth.logout')}
        onConfirm={() => { setShowLogoutConfirm(false); logout() }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <PricingModal open={showPricing} onClose={() => setShowPricing(false)} />
    </div>
  )
}
