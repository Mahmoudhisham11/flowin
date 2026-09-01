'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLocale } from '@/contexts/LocaleContext'
import { changePassword } from '@/services/firebaseAuth'
import { createQuickExpenseToken, revokeQuickExpenseToken } from '@/services/quickTokenService'
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  requestAndGetFcmToken,
  registerDeviceToken,
} from '@/services/firebaseMessaging'
import { t } from '@/lib/translations'
import useSmoothClose from '@/hooks/useSmoothClose'
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

  // Quick Expense Token state
  const [generatedToken, setGeneratedToken] = useState('')
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [tokenActiveState, setTokenActiveState] = useState(userData?.quickExpenseToken?.active || false)
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)

  // Push Notifications state
  const [notifPermission, setNotifPermission] = useState('default')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState('')
  const [notifError, setNotifError] = useState('')
  const [testPushLoading, setTestPushLoading] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNotifPermission(getNotificationPermissionState())
    }
  }, [])

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

  const handleGenerateToken = async () => {
    if (!user?.uid) return
    setTokenLoading(true)
    setTokenError('')
    try {
      const res = await createQuickExpenseToken(user.uid)
      setGeneratedToken(res.rawToken)
      setTokenActiveState(true)
      setShowTokenModal(true)
    } catch (err) {
      setTokenError(err.message || 'Failed to generate token')
    } finally {
      setTokenLoading(false)
    }
  }

  const handleEnableNotifications = async () => {
    if (!user) return
    setNotifLoading(true)
    setNotifError('')
    setNotifSuccess('')

    try {
      const supported = await isPushNotificationSupported()
      if (!supported) {
        throw new Error(isAr ? 'الإشعارات الفورية غير مدعومة على هذا المتصفح. إذا كنت تستخدم iPhone، تأكد من إضافة Flowin إلى الشاشة الرئيسية (Add to Home Screen) أولاً.' : 'Push notifications are not supported on this browser. On iPhone, make sure to Add to Home Screen first.')
      }

      const fcmToken = await requestAndGetFcmToken()
      const idToken = await user.getIdToken()
      const res = await registerDeviceToken(fcmToken, idToken)

      if (res.success) {
        setNotifPermission('granted')
        setNotifSuccess(isAr ? 'تم تفعيل الإشعارات بنجاح على هذا الجهاز! 🎉' : 'Notifications enabled successfully! 🎉')
      } else {
        throw new Error(res.error || 'Failed to register device token')
      }
    } catch (err) {
      console.error('Failed to enable notifications:', err)
      setNotifPermission(getNotificationPermissionState())
      setNotifError(err.message || (isAr ? 'فشل تفعيل الإشعارات' : 'Failed to enable notifications'))
    } finally {
      setNotifLoading(false)
    }
  }

  const handleSendTestPush = async () => {
    if (!user) return
    setTestPushLoading(true)
    setNotifError('')
    setNotifSuccess('')

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/notifications/test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        setNotifSuccess(isAr ? 'تم إرسال إشعار تجريبي! تفقد شريط الإشعارات 🔔' : 'Test notification sent! Check your notifications 🔔')
      } else {
        throw new Error(data.error || 'Failed to send test push')
      }
    } catch (err) {
      setNotifError(err.message || 'Failed to send test push')
    } finally {
      setTestPushLoading(false)
    }
  }

  const handleRevokeToken = async () => {
    if (!user?.uid) return
    setTokenLoading(true)
    try {
      await revokeQuickExpenseToken(user.uid)
      setTokenActiveState(false)
      setGeneratedToken('')
      setShowRevokeConfirm(false)
    } catch (err) {
      setTokenError(err.message || 'Failed to revoke token')
    } finally {
      setTokenLoading(false)
    }
  }

  const handleCopyToken = () => {
    if (!generatedToken) return
    navigator.clipboard.writeText(generatedToken)
    setTokenCopied(true)
    setTimeout(() => setTokenCopied(false), 2000)
  }

  const { isClosing: isPwdClosing, handleClose: handleClosePwd } = useSmoothClose(() => setShowPwdModal(false))
  const { isClosing: isTokenClosing, handleClose: handleCloseToken } = useSmoothClose(() => setShowTokenModal(false))
  const { isClosing: isGuideClosing, handleClose: handleCloseGuide } = useSmoothClose(() => setShowGuideModal(false))

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

        {/* Push Notifications Card */}
        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.cardHeaderFlex}>
                  <h2 className={styles.sectionTitle}>{t('settings.notifications')}</h2>
                  {notifPermission === 'granted' && (
                    <span className={`${styles.notifStatusBadge} ${styles.notifActiveBadge}`}>
                      <span className={styles.badgeDot}></span>
                      {t('settings.notificationsEnabled')}
                    </span>
                  )}
                  {notifPermission === 'denied' && (
                    <span className={`${styles.notifStatusBadge} ${styles.notifDeniedBadge}`}>
                      {t('settings.notificationsDenied')}
                    </span>
                  )}
                </div>
                <p className={styles.sectionDesc}>{t('settings.notificationsDesc')}</p>
              </div>
            </div>

            <div className={styles.tokenBox}>
              <div className={styles.notifBtnRow}>
                <button
                  className={styles.notifPrimaryBtn}
                  onClick={handleEnableNotifications}
                  disabled={notifLoading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>
                    {notifLoading
                      ? (isAr ? 'جاري التفعيل...' : 'Enabling...')
                      : (notifPermission === 'granted' ? (isAr ? 'إعادة ربط هذا الجهاز' : 'Re-sync this device') : t('settings.enableNotifications'))}
                  </span>
                </button>

                {notifPermission === 'granted' && (
                  <button
                    className={styles.notifSecondaryBtn}
                    onClick={handleSendTestPush}
                    disabled={testPushLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>{testPushLoading ? (isAr ? 'جاري الإرسال...' : 'Sending...') : t('settings.sendTestPush')}</span>
                  </button>
                )}
              </div>

              {notifSuccess && (
                <div className={styles.notifAlertSuccess}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{notifSuccess}</span>
                </div>
              )}

              {notifError && (
                <div className={styles.notifAlertError}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{notifError}</span>
                </div>
              )}

              {/* iOS PWA Instructions Guide Box */}
              <div className={styles.notifIosGuide}>
                <div className={styles.notifIosTitle}>
                  <span>{t('settings.iosPwaGuideTitle')}</span>
                </div>
                <ol className={styles.notifIosList}>
                  <li>{t('settings.iosPwaStep1')}</li>
                  <li>{t('settings.iosPwaStep2')}</li>
                  <li>{t('settings.iosPwaStep3')}</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* iPhone Shortcuts & Back Tap Integration Card */}
        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div className={`${styles.sectionIcon} ${styles.shortcutIcon}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.cardHeaderFlex}>
                  <h2 className={styles.sectionTitle}>{t('settings.shortcutsTitle')}</h2>
                  {tokenActiveState && (
                    <span className={styles.badgeActive}>
                      <span className={styles.badgeDot}></span>
                      {t('settings.tokenActive')}
                    </span>
                  )}
                </div>
                <p className={styles.sectionDesc}>{t('settings.shortcutsDesc')}</p>
              </div>
            </div>

            <div className={styles.tokenBox}>
              <div className={styles.tokenMetaRow}>
                <div className={styles.tokenStatusText}>
                  {tokenActiveState ? (
                    <span>
                      {isAr ? 'حسابك جاهز لاستقبال مصاريف من الـ Shortcut' : 'Your account is ready for iOS Shortcut logging'}
                      {userData?.quickExpenseToken?.prefix && (
                        <code className={styles.tokenPrefixCode}>{userData.quickExpenseToken.prefix}</code>
                      )}
                    </span>
                  ) : (
                    <span>{isAr ? 'لم تقم بإنشاء API Token بعد للـ Shortcut' : 'No active API token generated yet for Shortcuts'}</span>
                  )}
                </div>

                <div className={styles.tokenBtnGroup}>
                  <button
                    className={styles.tokenActionBtn}
                    onClick={handleGenerateToken}
                    disabled={tokenLoading}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    <span>{tokenActiveState ? t('settings.regenerateToken') : t('settings.generateToken')}</span>
                  </button>

                  <button
                    className={styles.tokenGuideBtn}
                    onClick={() => setShowGuideModal(true)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>{t('settings.setupGuide')}</span>
                  </button>

                  {tokenActiveState && (
                    <button
                      className={styles.tokenRevokeBtn}
                      onClick={() => setShowRevokeConfirm(true)}
                      disabled={tokenLoading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>{t('settings.revokeToken')}</span>
                    </button>
                  )}
                </div>
              </div>
              {tokenError && <p className={styles.errorText}>{tokenError}</p>}
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
        <div className={`${styles.overlay} ${isPwdClosing ? styles.overlayClosing : ''}`} onClick={() => { if (!pwdLoading) handleClosePwd() }}>
          <div className={`${styles.modal} ${isPwdClosing ? styles.modalClosing : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{t('auth.changePassword')}</h2>
              <button className={styles.modalClose} onClick={() => { if (!pwdLoading) handleClosePwd() }}>
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

      {/* Token Generated Modal */}
      {showTokenModal && (
        <div className={`${styles.overlay} ${isTokenClosing ? styles.overlayClosing : ''}`} onClick={() => handleCloseToken()}>
          <div className={`${styles.modal} ${isTokenClosing ? styles.modalClosing : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isAr ? 'رمز الـ API الشخصي لـ iOS Shortcuts' : 'Personal API Token for Shortcuts'}</h2>
              <button className={styles.modalClose} onClick={() => handleCloseToken()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.warningAlert}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className={styles.warningAlertText}>{t('settings.tokenWarning')}</p>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>{isAr ? 'رمز الـ API الخاص بك (يظهر لمرة واحدة فقط):' : 'Your Personal API Token (shown once):'}</label>
                <div className={styles.tokenDisplayWrap}>
                  <input
                    className={styles.tokenDisplayInput}
                    type="text"
                    readOnly
                    value={generatedToken}
                    onClick={(e) => e.target.select()}
                  />
                  <button className={styles.copyBtn} onClick={handleCopyToken}>
                    {tokenCopied ? (
                      <span className={styles.copiedBadge}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {isAr ? 'تم النسخ' : 'Copied'}
                      </span>
                    ) : (
                      <span className={styles.copyText}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        {isAr ? 'نسخ' : 'Copy'}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <div className={styles.quickStepsBox}>
                <h4 className={styles.quickStepsTitle}>{isAr ? 'خطوات سريعة لإعداد الـ Shortcut:' : 'Quick Shortcut Setup:'}</h4>
                <ol className={styles.quickStepsList}>
                  <li>{t('settings.step1')}</li>
                  <li>{t('settings.step2')}</li>
                  <li>{t('settings.step3')}</li>
                </ol>
              </div>

              <button className={styles.saveBtn} onClick={() => { handleCloseToken(); setShowGuideModal(true) }}>
                {isAr ? 'عرض خطوات إنشاء الـ Shortcut بالتفصيل 📱' : 'View Full Shortcut Setup Instructions 📱'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shortcut Setup Guide Modal */}
      {showGuideModal && (
        <div className={`${styles.overlay} ${isGuideClosing ? styles.overlayClosing : ''}`} onClick={() => handleCloseGuide()}>
          <div className={`${styles.modal} ${styles.guideModal} ${isGuideClosing ? styles.modalClosing : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{isAr ? '📱 خطوات إعداد iPhone Shortcut & Back Tap' : '📱 iPhone Shortcut & Back Tap Setup Guide'}</h2>
              <button className={styles.modalClose} onClick={() => handleCloseGuide()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.guideStepList}>
                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>1</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'إدخال المبلغ (Amount)' : 'Ask for Amount'}</strong>
                    <p>{isAr ? 'أضف Ask for Input بنوع Number (كام دفعت؟).' : 'Add "Ask for Input" with type Number (Prompt: "How much?").'}</p>
                  </div>
                </div>

                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>2</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'إدخال سبب الصرف (Reason)' : 'Ask for Reason'}</strong>
                    <p>{isAr ? 'أضف Ask for Input بنوع Text (سبب الصرف؟ مثال: غداء مع صحابي، بنزين).' : 'Add "Ask for Input" with type Text (Prompt: "Reason?").'}</p>
                  </div>
                </div>

                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>3</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'تجهيز البيانات (Dictionary)' : 'Build Dictionary'}</strong>
                    <p>{isAr ? 'أضف أكشن Dictionary وضع بداخله الحقلين:' : 'Add "Dictionary" action with two keys:'}</p>
                    <code className={styles.guideCodeBlock}>
                      {`amount: Provided Input (Number)\nreason: Provided Input (Text)`}
                    </code>
                  </div>
                </div>

                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>4</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'إرسال الطلب (POST Request)' : 'Send Request'}</strong>
                    <p>{isAr ? 'أضف Get Contents of URL مع POST إلى:' : 'Add "Get Contents of URL" with POST to:'}</p>
                    <code className={styles.guideCodeBlock}>POST /api/quick-expense</code>
                    <p>{isAr ? 'مع Header:' : 'With Header:'}</p>
                    <code className={styles.guideCodeBlock}>Authorization: Bearer &lt;Your_Token&gt;</code>
                    <p>{isAr ? 'و Request Body بنوع JSON يربط الـ Dictionary من الخطوة 3.' : 'And Request Body JSON linked to the Dictionary.'}</p>
                  </div>
                </div>

                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>5</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'إشعار النجاح (Notification)' : 'Show Notification'}</strong>
                    <p>{isAr ? 'أضف Show Notification: "✅ تم تسجيل المصروف وخصمه بنجاح".' : 'Add "Show Notification": "✅ Expense recorded successfully".'}</p>
                  </div>
                </div>

                <div className={styles.guideStep}>
                  <div className={styles.guideStepNum}>6</div>
                  <div className={styles.guideStepContent}>
                    <strong>{isAr ? 'تفعيل ميزة Back Tap' : 'Enable Back Tap'}</strong>
                    <p>{isAr ? 'من إعدادات الآيفون: Settings ➔ Accessibility ➔ Touch ➔ Back Tap ➔ Double Tap ➔ اختر الـ Shortcut' : 'On iPhone: Settings ➔ Accessibility ➔ Touch ➔ Back Tap ➔ Double Tap ➔ Choose your Shortcut.'}</p>
                  </div>
                </div>
              </div>

              <button className={styles.saveBtn} onClick={() => handleCloseGuide()}>
                {isAr ? 'فهمت، إغلاق' : 'Got it, Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirm Dialog */}
      <ConfirmDialog
        open={showRevokeConfirm}
        title={t('settings.revokeToken')}
        message={isAr ? 'هل أنت متأكد من إلغاء تفعيل رمز الـ API؟ سيتوقف الـ Shortcut المرتبط عن العمل فورًا.' : 'Are you sure you want to revoke this API token? Any linked Shortcuts will stop working immediately.'}
        confirmLabel={t('settings.revokeToken')}
        onConfirm={handleRevokeToken}
        onCancel={() => setShowRevokeConfirm(false)}
      />

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
