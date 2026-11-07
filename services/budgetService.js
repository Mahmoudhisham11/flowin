import { db } from '@/lib/firestore'
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { findMatchingCategory } from '@/lib/budgetMatch'
import { authFetch } from '@/lib/authFetch'

const DOC_PATH = (uid) => `users/${uid}/budget/config`

export const DEFAULT_BUDGET = {
  monthlyIncome: 0,
  essentialCategories: [],
}

export async function getBudget(uid) {
  const ref = doc(db, DOC_PATH(uid))
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function saveBudget(uid, data) {
  const ref = doc(db, DOC_PATH(uid))
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await updateDoc(ref, { ...data, updatedAt: new Date().toISOString() })
  } else {
    await setDoc(ref, { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
}

export async function generateAIDailyBudget(uid, budgetData, lang = 'ar') {
  const res = await authFetch('/api/ai/daily-budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      monthlyIncome: budgetData.monthlyIncome,
      essentialCategories: budgetData.essentialCategories,
      totalEssentials: budgetData.totalEssentials,
      remaining: budgetData.remaining,
      lang,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to generate AI daily budget')
  }

  const result = await res.json()

  if (uid) {
    const ref = doc(db, DOC_PATH(uid))
    await updateDoc(ref, {
      aiDailyBudget: {
        ...result,
        generatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    }).catch(async () => {
      await setDoc(ref, {
        monthlyIncome: budgetData.monthlyIncome || 0,
        essentialCategories: budgetData.essentialCategories || [],
        aiDailyBudget: {
          ...result,
          generatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    })
  }

  return result
}

export function subscribeToBudget(uid, callback) {
  const ref = doc(db, DOC_PATH(uid))
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function deductFromBudget(uid, categoryName, amount) {
  try {
    const ref = doc(db, DOC_PATH(uid))
    const snap = await getDoc(ref)
    if (!snap.exists()) { console.warn('deductFromBudget: no budget doc for', uid); return }

    const data = snap.data()
    const categories = (data.essentialCategories || []).map((c) => ({ ...c }))
    if (categories.length === 0) { console.warn('deductFromBudget: no essentialCategories'); return }

    const match = findMatchingCategory(categories, categoryName)
    if (!match) { console.warn('deductFromBudget: no match for', categoryName); return }

    const beforeSpent = Number(match.spent) || 0
    match.spent = beforeSpent + Number(amount)
    console.log('deductFromBudget:', { name: match.name, beforeSpent, added: Number(amount), newSpent: match.spent })

    await updateDoc(ref, {
      essentialCategories: categories,
      updatedAt: new Date().toISOString(),
    })
    console.log('deductFromBudget saved')
  } catch (err) {
    console.error('deductFromBudget error:', err)
  }
}

export async function refundFromBudget(uid, categoryName, amount) {
  try {
    const ref = doc(db, DOC_PATH(uid))
    const snap = await getDoc(ref)
    if (!snap.exists()) { console.warn('refundFromBudget: no budget doc for', uid); return }

    const data = snap.data()
    const categories = (data.essentialCategories || []).map((c) => ({ ...c }))
    if (categories.length === 0) { console.warn('refundFromBudget: no essentialCategories'); return }

    const match = findMatchingCategory(categories, categoryName)
    if (!match) { console.warn('refundFromBudget: no match for', categoryName); return }

    const beforeSpent = Number(match.spent) || 0
    match.spent = Math.max(0, beforeSpent - Number(amount))
    console.log('refundFromBudget:', { name: match.name, beforeSpent, refunded: Number(amount), newSpent: match.spent })

    await updateDoc(ref, {
      essentialCategories: categories,
      updatedAt: new Date().toISOString(),
    })
    console.log('refundFromBudget saved')
  } catch (err) {
    console.error('refundFromBudget error:', err)
  }
}

export async function resetMonthlyBudget(uid) {
  const ref = doc(db, DOC_PATH(uid))
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const categories = (data.essentialCategories || []).map((c) => ({
    ...c,
    spent: 0,
  }))
  await updateDoc(ref, {
    essentialCategories: categories,
    updatedAt: new Date().toISOString(),
  })
}
