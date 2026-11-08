'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/authFetch'
import { fillText } from '@/lib/fillText'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './AdminSystemPanel.module.css'

export default function AdminSystemPanel() {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: 'loading' })
  const [ai, setAi] = useState(null) // null | { running } | result

  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    authFetch('/api/admin/status')
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'failed')
        if (!cancelled) setState({ status: 'ready', checks: json.checks, info: json.info })
      })
      .catch((err) => {
        console.error('[admin] status failed:', err)
        if (!cancelled) setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [reloadKey])

  const refresh = () => {
    setState({ status: 'loading' })
    setReloadKey((k) => k + 1)
  }

  const testAi = async () => {
    setAi({ running: true })
    try {
      const res = await authFetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'ai' }),
      })
      const json = await res.json().catch(() => ({}))
      setAi(res.ok ? json : { ok: false, error: json.error || 'failed' })
    } catch (err) {
      setAi({ ok: false, error: err.message })
    }
  }

  const rows = state.status === 'ready' ? [
    ['firebaseProjectId', state.checks.firebaseProjectId, true],
    ['firebaseClientEmail', state.checks.firebaseClientEmail, true],
    ['firebasePrivateKey', state.checks.firebasePrivateKey, true],
    ['firestore', state.checks.firestore.ok, true, state.checks.firestore.ok ? `${state.checks.firestore.ms} ms` : state.checks.firestore.error],
    ['openRouterKey', state.checks.openRouterKey, true],
    ['vapidKey', state.checks.vapidKey, false],
    ['appUrl', state.checks.appUrl, false],
    ['supportEmail', state.checks.supportEmail, false],
  ] : []

  return (
    <section className={styles.panel}>
      <header className={styles.head}>
        <div>
          <h2>{t('admin.sys.title')}</h2>
          <p>{t('admin.sys.desc')}</p>
        </div>
        <button type="button" className={styles.btn} onClick={refresh} disabled={state.status === 'loading'}>{t('admin.sys.refresh')}</button>
      </header>

      {state.status === 'loading' && <p className={styles.note}>{t('admin.sys.loading')}</p>}
      {state.status === 'error' && <p className={styles.error} role="alert">{t('admin.sys.error')}</p>}

      {state.status === 'ready' && (
        <>
          <ul className={styles.rows}>
            {rows.map(([key, ok, required, detail]) => (
              <li key={key}>
                <span>{t(`admin.sys.${key}`)}</span>
                <span className={`${styles.pill} ${ok ? styles.pillOk : required ? styles.pillBad : styles.pillWarn}`}>
                  {ok ? t('admin.sys.ok') : required ? t('admin.sys.missing') : t('admin.sys.optional')}
                  {detail ? ` · ${detail}` : ''}
                </span>
              </li>
            ))}
          </ul>

          <dl className={styles.info}>
            <div><dt>{t('admin.sys.environment')}</dt><dd>{state.info.environment}</dd></div>
            {state.info.commit && <div><dt>{t('admin.sys.commit')}</dt><dd>{state.info.commit}</dd></div>}
            <div><dt>{t('admin.sys.proPrice')}</dt><dd>{state.info.proPrice}</dd></div>
            <div><dt>{t('admin.sys.aiLimit')}</dt><dd>{state.info.aiChatDailyLimit}</dd></div>
          </dl>

          <div className={styles.test}>
            <button type="button" className={styles.primary} onClick={testAi} disabled={ai?.running}>
              {ai?.running ? t('admin.sys.aiTesting') : t('admin.sys.aiTest')}
            </button>
            {ai && !ai.running && (
              <p className={ai.ok ? styles.testOk : styles.error} role="status">
                {ai.ok ? fillText(t('admin.sys.aiOk'), { ms: ai.ms }) : `${t('admin.sys.aiFail')}: ${ai.error}`}
              </p>
            )}
          </div>

          <p className={styles.hint}>{t('admin.sys.hint')}</p>
        </>
      )}
    </section>
  )
}
