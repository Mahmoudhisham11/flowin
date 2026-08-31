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
  const walletsRef = useRef([])

  const startRecording = useCallback(async (lang = 'ar-EG', budgetCategories = [], wallets = []) => {
    setError('')
    setTranscript('')
    setExpenses([])
    setStep(STEPS.RECORDING)
    budgetRef.current = budgetCategories || []
    walletsRef.current = wallets || []

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
        if (!finalText || !finalText.trim()) {
          setError('لم يتم التعرف على كلام - No speech recognized')
          setStep(STEPS.IDLE)
          return
        }
        setTranscript(finalText)
        setStep(STEPS.PROCESSING)
        try {
          const result = await parseExpenseFromText(finalText, budgetRef.current, walletsRef.current)
          if (result.error) {
            setError(result.error)
            setStep(STEPS.IDLE)
          } else if (Array.isArray(result.expenses) && result.expenses.length > 0) {
            setExpenses(result.expenses)
            setStep(STEPS.PREVIEW)
          } else {
            setError('Could not parse any transaction from speech')
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

  const confirmExpenses = useCallback(async (defaultWalletId, userWallets = []) => {
    if (!user || expenses.length === 0) return
    setStep(STEPS.SAVING)
    try {
      const walletDeltas = {}

      const promises = expenses.map((exp) => {
        const wid = exp.walletId || defaultWalletId || ''
        const amt = Number(exp.amount) || 0
        const isIncome = exp.type === 'income'

        if (wid) {
          walletDeltas[wid] = (walletDeltas[wid] || 0) + (isIncome ? amt : -amt)
        }

        const matchedWallet = userWallets.find((w) => w.id === wid)

        return saveTransaction(user.uid, {
          amount: amt,
          currency: exp.currency || 'EGP',
          category: exp.category || (isIncome ? 'Other' : 'Food'),
          merchant: exp.merchant || '',
          reason: exp.reason || '',
          type: isIncome ? 'income' : 'expense',
          source: 'voice',
          walletId: wid,
          walletName: matchedWallet?.name || '',
        })
      })

      await Promise.all(promises)

      const walletUpdates = Object.entries(walletDeltas).map(async ([wid, delta]) => {
        const walletRef = doc(db, 'users', user.uid, 'wallets', wid)
        const snap = await getDoc(walletRef)
        if (snap.exists()) {
          const currentBal = Number(snap.data().balance || 0)
          await updateWallet(user.uid, wid, { balance: currentBal + delta })
        }
      })

      await Promise.all(walletUpdates)

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
