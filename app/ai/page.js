'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useUser } from '@/contexts/UserContext'
import { authFetch } from '@/lib/authFetch'
import { useSearchParams } from 'next/navigation'
import { AIIcon } from '@/components/Icons'
import { useTranslation } from '@/hooks/useTranslation'
import { fillText } from '@/lib/fillText'
import styles from './page.module.css'

function hasArabic(text) {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}

function AIPageContent() {
  const { user, userData } = useUser()
  const { t, lang } = useTranslation()
  const searchParams = useSearchParams()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState(null) // { limit, remaining } (limit null = unlimited)
  const bottomRef = useRef(null)
  const initSent = useRef(false)

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading || !user) return
    const userMsg = { role: 'user', text: input.trim() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }))

      const res = await authFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history,
          lang,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const e = new Error(data.error || 'AI request failed')
        e.code = data.code
        throw e
      }
      if (data.quota) setQuota(data.quota)

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          suggestions: data.suggestions || [],
          confidence: data.confidence,
        },
      ])
    } catch (err) {
      if (err.code === 'DAILY_LIMIT') setQuota((q) => ({ ...(q || {}), remaining: 0 }))
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.code === 'DAILY_LIMIT' ? t('ai.limitReached') : err.message && err.message !== 'AI request failed' ? err.message : t('ai.busy'),
          suggestions: [],
          error: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, user, messages, lang, t])

  // How many messages are left today.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    authFetch('/api/ai/chat')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.quota) setQuota(d.quota) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const msg = searchParams.get('msg')
    if (msg && !initSent.current && user) {
      initSent.current = true
      setInput(msg)
    }
  }, [searchParams, user])

  useEffect(() => {
    if (initSent.current && !loading && messages.length === 0 && input && user) {
      const timer = setTimeout(() => handleSend(), 300)
      return () => clearTimeout(timer)
    }
  }, [input, loading, messages.length, user, handleSend])

  const handleSuggestionClick = (text) => {
    setInput(text)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('ai.title')}</h1>
        <p className={styles.subtitle}>{t('ai.subtitle')}</p>
      </header>

      <div className={styles.chat}>
        <div className={styles.messages}>
          {messages.length === 0 && (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>
                <AIIcon width="28" height="28" />
              </div>
              <h2 className={styles.welcomeTitle}>{t('ai.title')}</h2>
              <p className={styles.welcomeText}>{t('ai.noContext')}</p>
              <div className={styles.suggestionChips}>
                {[t('ai.chip1'), t('ai.chip2'), t('ai.chip3'), t('ai.chip4')].map((s) => (
                  <button key={s} className={styles.chip} onClick={() => handleSuggestionClick(s)} dir="auto">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`${styles.msg} ${msg.role === 'user' ? styles.userMsg : styles.aiMsg}`}>
              {msg.role === 'assistant' && (
                <div className={styles.msgAvatar}>
                  <AIIcon width="16" height="16" />
                </div>
              )}
              <div className={`${styles.msgBubble} ${msg.error ? styles.errorBubble : ''}`} dir="auto">
                <p className={styles.msgText} dir="auto">{msg.text}</p>
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className={styles.suggestions} dir="auto">
                    {msg.suggestions.map((s, j) => (
                      <button key={j} className={styles.suggestionBtn} onClick={() => handleSuggestionClick(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className={`${styles.msg} ${styles.aiMsg}`}>
              <div className={styles.msgAvatar}>
                <AIIcon width="16" height="16" />
              </div>
              <div className={styles.msgBubble} dir="auto">
                <div className={styles.typing}>
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className={styles.inputArea}>
          <input
            className={styles.chatInput}
            type="text"
            dir="auto"
            placeholder={loading ? t('ai.thinking') : t('ai.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={loading || quota?.remaining === 0}
            maxLength={500}
          />
          <button className={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || loading || quota?.remaining === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className={styles.footnote}>
          {quota?.remaining !== null && quota?.remaining !== undefined && (
            <span>{fillText(t('ai.quotaLeft'), { n: quota.remaining })}</span>
          )}
          <span>{t('ai.disclaimer')}</span>
        </div>
      </div>
    </div>
  )
}

export default function AIPage() {
  return (
    <Suspense>
      <AIPageContent />
    </Suspense>
  )
}
