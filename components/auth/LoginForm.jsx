'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './LoginForm.module.css'

export default function LoginForm() {
  const router = useRouter()
  const { signup, login, googleLogin, getErrorMessage } = useUser()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useTranslation()

  const isLogin = mode === 'login'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        if (!name.trim()) {
          setError(t('auth.nameRequired'))
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError(t('auth.passwordMinLength'))
          setLoading(false)
          return
        }
        await signup(name.trim(), email, password)
      }
      router.push('/')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await googleLogin()
      router.push('/')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(getErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode(isLogin ? 'register' : 'login')
    setError('')
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isLogin ? t('auth.welcomeBack') : t('auth.createAccount')}</h1>
        <p className={styles.subtitle}>{isLogin ? t('auth.signInToContinue') : t('auth.startJourney')}</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {!isLogin && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="auth-name">{t('auth.fullName')}</label>
            <div className={`${styles.inputWrap} ${name ? styles.hasValue : ''}`}>
              <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <input
                id="auth-name"
                className={styles.input}
                type="text"
                placeholder={t('auth.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required={!isLogin}
              />
            </div>
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="auth-email">{t('auth.email')}</label>
          <div className={`${styles.inputWrap} ${email ? styles.hasValue : ''}`}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            <input
              id="auth-email"
              className={styles.input}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="auth-password">{t('auth.password')}</label>
          <div className={`${styles.inputWrap} ${password ? styles.hasValue : ''}`}>
            <svg className={styles.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              id="auth-password"
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              placeholder={isLogin ? t('auth.passwordPlaceholder') : t('auth.passwordHint')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? (
            <span className={styles.btnLoading}>
              <span className={styles.spinner} />
              {isLogin ? t('auth.signingIn') : t('auth.creatingAccount')}
            </span>
          ) : (
            isLogin ? t('auth.signIn') : t('auth.signUp')
          )}
        </button>
      </form>

      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>{t('auth.or')}</span>
        <span className={styles.dividerLine} />
      </div>

      <button
        type="button"
        className={styles.googleBtn}
        onClick={handleGoogle}
        disabled={loading}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        {t('auth.googleSignIn')}
      </button>

      <div className={styles.switchArea}>
        {isLogin ? (
          <p className={styles.switchText}>
            {t('auth.noAccount')}{' '}
            <button type="button" className={styles.switchLink} onClick={toggleMode}>{t('auth.signUpLink')}</button>
          </p>
        ) : (
          <p className={styles.switchText}>
            {t('auth.hasAccount')}{' '}
            <button type="button" className={styles.switchLink} onClick={toggleMode}>{t('auth.signInLink')}</button>
          </p>
        )}
      </div>
    </div>
  )
}

