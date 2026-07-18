import styles from './Card.module.css'

export default function Card({ children, className, padding = 'md', ...props }) {
  return (
    <div
      className={`${styles.card} ${styles[`pad-${padding}`]} ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  )
}
