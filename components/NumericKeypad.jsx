'use client'

import styles from './NumericKeypad.module.css'

const keys = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '.', label: '.' },
  { value: '0', label: '0' },
  { value: 'delete', label: '⌫' },
]

export default function NumericKeypad({ onKeyPress }) {
  return (
    <div className={styles.keypad}>
      {keys.map((key) => (
        <button
          key={key.value}
          className={`${styles.key} ${key.value === 'delete' ? styles.delete : ''} ${key.value === '.' ? styles.dot : ''}`}
          onClick={() => onKeyPress(key.value)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}
