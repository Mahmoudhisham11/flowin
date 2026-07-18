'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '@/hooks/useTranslation'
import styles from './Select.module.css'

export default function Select({ value, onChange, options, placeholder, className = '' }) {
  const { t } = useTranslation()
  const placeholderText = placeholder ?? t('selectPlaceholder')
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState({})
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const openMenu = () => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = Math.min(options.length * 44 + 8, 240)
    const maxHeight = Math.min(240, spaceBelow - 8)

    setMenuStyle({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
    })
    setOpen(!open)
  }

  const selected = options.find((o) => o.value === value)

  return (
    <div className={`${styles.wrapper} ${className}`} ref={ref}>
      <button className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} onClick={openMenu} type="button">
        <span className={selected ? styles.triggerText : styles.placeholder}>
          {selected?.icon && <span className={styles.triggerIcon}>{selected.icon}</span>}
          <span>{selected ? selected.label : placeholderText}</span>
        </span>
        <svg className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`} width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && createPortal(
        <div className={styles.dropdownPortal} style={{ ...menuStyle }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.option} ${value === opt.value ? styles.optionActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              type="button"
            >
              {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
              <span className={styles.optionLabel}>{opt.label}</span>
              {value === opt.value && (
                <svg className={styles.checkmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
