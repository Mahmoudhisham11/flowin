import { db } from '@/lib/firestore'
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { createNotification } from './notificationService'
import { CATEGORIES } from '@/lib/categories'

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

export function subscribeToBudget(uid, callback) {
  const ref = doc(db, DOC_PATH(uid))
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

const normalizeArabic = (s) =>
  String(s).trim()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .toLowerCase()

function findMatchingCategory(categories, categoryName) {
  const nameLower = normalizeArabic(categoryName)

  let match = categories.find(
    (c) => normalizeArabic(c.name) === nameLower
  )
  if (match) return match

  match = categories.find(
    (c) => c.categoryId && normalizeArabic(c.categoryId) === nameLower
  )
  if (match) return match

  const catInfo = CATEGORIES.find(
    (c) => normalizeArabic(c.id) === nameLower || c.id.toLowerCase() === nameLower
  )
  if (catInfo) {
    match = categories.find(
      (c) =>
        normalizeArabic(c.name) === normalizeArabic(catInfo.labelAr) ||
        normalizeArabic(c.name) === normalizeArabic(catInfo.labelEn) ||
        c.name.trim().toLowerCase() === catInfo.labelEn.toLowerCase()
    )
    if (match) return match
  }

  return null
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

    const notified = { ...(data.notifiedThresholds || {}) }
    const catKey = normalizeArabic(match.name)
    const thresholdsNotified = new Set(notified[catKey] || [])

    const target = Number(match.amount) || 0
    const remaining = target - match.spent
    if (target > 0 && remaining <= target * 0.1 && remaining > 0 && !thresholdsNotified.has(10)) {
      thresholdsNotified.add(10)
      notified[catKey] = Array.from(thresholdsNotified)
      createNotification(uid, {
        type: 'budget_alert',
        title: `⚠️ ${match.name}`,
        message: `باقي ${remaining.toFixed(0)} جم من ${target.toFixed(0)} جم (10%)`,
        categoryName: match.name,
      }).catch(() => {})
    }

    await updateDoc(ref, {
      essentialCategories: categories,
      notifiedThresholds: notified,
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
      notifiedThresholds: data.notifiedThresholds || {},
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
    notifiedThresholds: {},
    updatedAt: new Date().toISOString(),
  })
}
