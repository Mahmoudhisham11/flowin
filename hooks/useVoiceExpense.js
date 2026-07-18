'use client'

import { useState, useRef, useCallback } from 'react'
import { useUser } from '@/contexts/UserContext'
import SpeechToTextService from '@/services/speechToText'
import { parseExpenseFromText } from '@/services/openRouterAI'
import { saveTransaction } from '@/services/transactionsService'
import { updateWallet } from '@/services/walletService'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firestore'

export const STEPS = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PROCESSING: 'processing',
  PREVIEW: 'preview',
  SAVING: 'saving',
  DONE: 'done',
}

export default function useVoiceExpense() {
  const { user } = useUser()
  const [step, setStep] = useState(STEPS.IDLE)
  const [transcript, setTranscript] = useState('')
  const [expenses, setExpenses] = useState([])
  const [error, setError] = useState('')
  const sttRef = useRef(null)
  const budgetRef = useRef([])

  const startRecording = useCallback(async (lang = 'ar-EG', budgetCategories = []) => {
    setError('')
    setTranscript('')
    setExpenses([])
    setStep(STEPS.RECORDING)
    budgetRef.current = budgetCategories

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((t) => t.stop())
      }
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Microphone permission denied. Please allow microphone access in your browser settings.' : err.message)
      setStep(STEPS.IDLE)
      return
    }

    const stt = new SpeechToTextService()
    sttRef.current = stt

    stt.start({
      language: lang,
      onResult: ({ final, interim }) => {
        setTranscript(final || interim)
      },
      onError: (err) => {
        setError(err.message)
        setStep(STEPS.IDLE)
      },
      onEnd: async (finalText) => {
        if (!finalText) {
          setError('لم يتم التعرف على كلام - No speech recognized')
          setStep(STEPS.IDLE)
          return
        }
        setTranscript(finalText)
        setStep(STEPS.PROCESSING)
        try {
          const result = await parseExpenseFromText(finalText, budgetRef.current)
          if (result.error) {
            setError(result.error)
            setStep(STEPS.IDLE)
          } else if (Array.isArray(result.expenses) && result.expenses.length > 0) {
            setExpenses(result.expenses)
            setStep(STEPS.PREVIEW)
          } else {
            setError('Could not parse any expense')
            setStep(STEPS.IDLE)
          }
        } catch (e) {
          setError(e.message)
          setStep(STEPS.IDLE)
        }
      },
    })
  }, [])

  const stopRecording = useCallback(() => {
    if (sttRef.current) {
      sttRef.current.stop()
      sttRef.current = null
    }
  }, [])

  const confirmExpenses = useCallback(async (walletId) => {
    if (!user || expenses.length === 0) return
    setStep(STEPS.SAVING)
    try {
      const promises = expenses.map((exp) =>
        saveTransaction(user.uid, {
          amount: Number(exp.amount),
          currency: exp.currency || 'EGP',
          category: exp.category || 'Other',
          merchant: exp.merchant || '',
          type: 'expense',
          source: 'voice',
          walletId: walletId || '',
        })
      )
      await Promise.all(promises)

      if (walletId) {
        const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
        const walletRef = doc(db, 'users', user.uid, 'wallets', walletId)
        const snap = await getDoc(walletRef)
        if (snap.exists()) {
          await updateWallet(user.uid, walletId, { balance: (snap.data().balance || 0) - total })
        }
      }

      setStep(STEPS.DONE)
    } catch (e) {
      setError(e.message)
      setStep(STEPS.PREVIEW)
    }
  }, [user, expenses])

  const updateExpense = useCallback((index, fields) => {
    setExpenses((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...fields }
      return next
    })
  }, [])

  const removeExpense = useCallback((index) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const cancel = useCallback(() => {
    stopRecording()
    setStep(STEPS.IDLE)
    setTranscript('')
    setExpenses([])
    setError('')
  }, [stopRecording])

  const reset = useCallback(() => {
    setStep(STEPS.IDLE)
    setTranscript('')
    setExpenses([])
    setError('')
  }, [])

  return {
    step,
    transcript,
    expenses,
    error,
    startRecording,
    stopRecording,
    confirmExpenses,
    updateExpense,
    removeExpense,
    cancel,
    reset,
    STEPS,
  }
}

