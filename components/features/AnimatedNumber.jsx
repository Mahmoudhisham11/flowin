'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export default function AnimatedNumber({ value, duration = 800, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)
  const valRef = useRef(value)

  const animate = useCallback(() => {
    const target = Number(value) || 0
    const startTime = performance.now()

    function step(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(target * eased * Math.pow(10, decimals)) / Math.pow(10, decimals)
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [value, duration, decimals])

  useEffect(() => {
    valRef.current = value
    started.current = false
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [value, animate])

  return (
    <span ref={ref}>
      {prefix}{display.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  )
}

