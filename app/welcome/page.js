'use client'

import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { useLocale } from '@/contexts/LocaleContext'
import { welcomeContent } from '@/lib/welcomeContent'
import { PRO_PRICE, PRO_PRICE_CURRENCY } from '@/lib/plans'
import styles from './page.module.css'

// Line icons for the feature cards (no emoji).
const ICONS = {
  day: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2.5l2.4 11h10.2l2-8H7" /></>,
  goal: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" /></>,
  chart: <path d="M5 20v-9M12 20V5M19 20v-6" />,
  chat: <path d="M21 12a8 8 0 0 1-11.7 7L4 20l1.1-4.3A8 8 0 1 1 21 12z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
}

export default function WelcomePage() {
  const { user } = useUser()
  const { lang, setLang } = useLocale()
  const c = welcomeContent[lang] || welcomeContent.en
  const ctaHref = user ? '/' : '/login'

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.brand}>{c.brand}</span>
        <div className={styles.navRight}>
          <div className={styles.langs} role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? styles.langOn : ''} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'ar'} className={lang === 'ar' ? styles.langOn : ''} onClick={() => setLang('ar')}>عربي</button>
          </div>
          <Link href={ctaHref} className={styles.signIn}>{user ? c.ctaOpen : c.signIn}</Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <h1>{c.heroTitle}</h1>
          <p>{c.heroSub}</p>
          <Link href={ctaHref} className={styles.cta}>{user ? c.ctaOpen : c.cta}</Link>
          {!user && <small>{c.ctaNote}</small>}
        </section>

        <section className={styles.section} aria-labelledby="features">
          <h2 id="features">{c.featuresTitle}</h2>
          <div className={styles.grid}>
            {c.features.map((f) => (
              <article key={f.h} className={styles.card}>
                <span className={styles.icon} aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[f.icon]}</svg>
                </span>
                <h3>{f.h}</h3>
                <p>{f.p}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="steps">
          <h2 id="steps">{c.stepsTitle}</h2>
          <ol className={styles.steps}>
            {c.steps.map((s, i) => (
              <li key={s.h}>
                <span className={styles.num}>{i + 1}</span>
                <div><h3>{s.h}</h3><p>{s.p}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.section} aria-labelledby="pricing">
          <h2 id="pricing">{c.pricingTitle}</h2>
          <div className={styles.plans}>
            <article className={styles.plan}>
              <h3>{c.free.name}</h3>
              <div className={styles.price}>{PRO_PRICE_CURRENCY} {c.free.price} <small>/ {c.free.per}</small></div>
              <ul>{c.free.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </article>
            <article className={`${styles.plan} ${styles.planPro}`}>
              <h3>{c.pro.name}</h3>
              <div className={styles.price}>{PRO_PRICE_CURRENCY} {PRO_PRICE} <small>{c.pro.per}</small></div>
              <ul>{c.pro.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </article>
          </div>
          <div className={styles.center}>
            <Link href={ctaHref} className={styles.cta}>{user ? c.ctaOpen : c.cta}</Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>{c.footerTagline}</p>
        <nav>
          <Link href="/privacy">{c.privacy}</Link>
          <Link href="/terms">{c.terms}</Link>
        </nav>
      </footer>
    </div>
  )
}
