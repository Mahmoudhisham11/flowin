'use client'

import styles from './Input.module.css'

export default function Input({ label, error, icon, className, ...props }) {
  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={`${styles.inputWrap} ${error ? styles.hasError : ''} ${icon ? styles.hasIcon : ''}`}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input className={styles.input} {...props} />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  )
}
