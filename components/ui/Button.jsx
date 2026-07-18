'use client'

import styles from './Button.module.css'

export default function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  type = 'button',
}) {
  return (
    <button
      type={type}
      className={`${styles.btn} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ''} ${loading ? styles.loading : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className={styles.spinner} />}
      <span className={loading ? styles.loadingText : ''}>{children}</span>
    </button>
  )
}
