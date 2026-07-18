import styles from './SummaryCard.module.css'

export default function SummaryCard({ spent, goal, label }) {
  const percentage = Math.min((spent / goal) * 100, 100)

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>{label || 'Monthly Spending'}</h3>
        <span className={styles.percentage}>{percentage.toFixed(0)}%</span>
      </div>
      <div className={styles.amounts}>
        <span className={styles.spent}>${spent.toLocaleString()}</span>
        <span className={styles.goal}>of ${goal.toLocaleString()}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.bar} style={{ width: `${percentage}%` }} />
      </div>
      <p className={styles.note}>
        Save ${(goal - spent).toLocaleString()} more this month to reach your goal
      </p>
    </div>
  )
}
