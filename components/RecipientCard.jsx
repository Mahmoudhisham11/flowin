import styles from './RecipientCard.module.css'

export default function RecipientCard({ name, accountNumber, avatarColor }) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className={styles.card}>
      <div className={styles.avatar} style={{ backgroundColor: avatarColor || '#4DA3FF' }}>
        {initials}
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        <span className={styles.account}>Account: {accountNumber}</span>
      </div>
    </div>
  )
}
