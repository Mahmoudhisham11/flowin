'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/firestore'
import { doc, onSnapshot } from 'firebase/firestore'

export function useInsights(uid) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!uid) {
      setInsight(null)
      setLoading(false)
      return
    }

    const now = new Date()
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
    const weekId = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`

    const ref = doc(db, `users/${uid}/insights`, weekId)

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setInsight({ id: snap.id, ...snap.data() })
        } else {
          setInsight(null)
        }
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return unsub
  }, [uid])

  return { insight, loading, error }
}

