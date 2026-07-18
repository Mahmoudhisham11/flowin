'use client'

import styles from './AuthLayout.module.css'

export default function AuthLayout({ children }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.brandSide}>
        <div className={styles.brandContent}>
          <div className={styles.brandLogo}>
            <div className={styles.logoMark}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className={styles.brandName}>Finance AI</span>
          </div>
          <h1 className={styles.brandTagline}>Your intelligent financial assistant</h1>
          <p className={styles.brandDesc}>
            Track spending, set goals, and get AI-powered insights to make smarter financial decisions.
          </p>
          <div className={styles.decorations}>
            <div className={`${styles.decoCard} ${styles.decoCard1}`}>
              <div className={styles.decoChart}>
                <div className={styles.decoBar} style={{ height: '60%' }} />
                <div className={styles.decoBar} style={{ height: '85%' }} />
                <div className={styles.decoBar} style={{ height: '45%' }} />
                <div className={styles.decoBar} style={{ height: '70%' }} />
                <div className={styles.decoBar} style={{ height: '90%' }} />
              </div>
              <div className={styles.decoLabel}>Monthly Growth</div>
            </div>
            <div className={`${styles.decoCard} ${styles.decoCard2}`}>
              <div className={styles.decoPie}>
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="4" strokeDasharray="60 80" strokeDashoffset="0" />
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="4" strokeDasharray="40 100" strokeDashoffset="-60" />
                </svg>
              </div>
              <div className={styles.decoLabel}>Spending Breakdown</div>
            </div>
            <div className={`${styles.decoBadge} ${styles.decoBadge1}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              AI Powered
            </div>
            <div className={`${styles.decoBadge} ${styles.decoBadge2}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Secure
            </div>
          </div>
        </div>
      </div>
      <div className={styles.formSide}>
        {children}
      </div>
    </div>
  )
}
