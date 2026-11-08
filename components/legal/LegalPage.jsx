'use client'

import Link from 'next/link'
import { useLocale } from '@/contexts/LocaleContext'
import { LEGAL_UPDATED } from '@/lib/legalContent'
import styles from './LegalPage.module.css'

export default function LegalPage({ content }) {
  const { lang, setLang } = useLocale()
  const c = content[lang] || content.en
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.top}>
          <Link href="/welcome" className={styles.back}>{lang === 'ar' ? 'فلوين' : 'Flowin'}</Link>
          <div className={styles.langs} role="group" aria-label="Language">
            <button type="button" aria-pressed={lang === 'en'} className={lang === 'en' ? styles.langOn : ''} onClick={() => setLang('en')}>EN</button>
            <button type="button" aria-pressed={lang === 'ar'} className={lang === 'ar' ? styles.langOn : ''} onClick={() => setLang('ar')}>عربي</button>
          </div>
        </div>

        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.updated}>{lang === 'ar' ? 'آخر تحديث' : 'Last updated'}: {LEGAL_UPDATED}</p>
        <p className={styles.intro}>{c.intro}</p>

        {c.sections.map((s) => (
          <section key={s.h} className={styles.section}>
            <h2>{s.h}</h2>
            {s.p.map((para) => <p key={para}>{para}</p>)}
          </section>
        ))}

        {email && (
          <section className={styles.section}>
            <h2>{lang === 'ar' ? 'تواصل معنا' : 'Contact'}</h2>
            <p><a href={`mailto:${email}`}>{email}</a></p>
          </section>
        )}

        <nav className={styles.footer}>
          <Link href="/privacy">{lang === 'ar' ? 'سياسة الخصوصية' : 'Privacy policy'}</Link>
          <Link href="/terms">{lang === 'ar' ? 'شروط الاستخدام' : 'Terms of use'}</Link>
          <Link href="/">{lang === 'ar' ? 'افتح التطبيق' : 'Open the app'}</Link>
        </nav>
      </div>
    </div>
  )
}
