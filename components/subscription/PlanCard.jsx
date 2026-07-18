'use client'

import styles from './PlanCard.module.css'

function FreeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function ProIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

export default function PlanCard({ plan, isPopular, onSelect, isActive, loading, iconType }) {
  return (
    <div className={`${styles.card} ${isPopular ? styles.popular : ''} ${isPopular ? styles.popularPadding : ''} ${isActive ? styles.active : ''}`}>
      {isPopular && <div className={styles.badge}>Most Popular</div>}

      <div className={`${styles.iconWrap} ${iconType === 'pro' ? styles.iconPro : styles.iconFree}`}>
        {iconType === 'pro' ? <ProIcon /> : <FreeIcon />}
      </div>

      <h3 className={styles.name}>{plan.name}</h3>

      <div className={styles.priceRow}>
        <span className={styles.price}>{plan.price}</span>
        {plan.period && <span className={styles.period}>/{plan.period}</span>}
      </div>

      <p className={styles.desc}>{plan.desc}</p>

      <ul className={styles.features}>
        {plan.features.map((f, i) => (
          <li key={i} className={styles.feature}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <button
        className={`${styles.selectBtn} ${isPopular ? styles.selectBtnPopular : ''} ${isActive ? styles.selectBtnActive : ''}`}
        onClick={onSelect}
        disabled={loading || isActive}
      >
        {loading ? (
          <span className={styles.spinner} />
        ) : isActive ? (
          'Current Plan'
        ) : plan.cta}
      </button>
    </div>
  )
}
