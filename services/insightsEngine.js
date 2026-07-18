import { db } from '@/lib/firestore'
import { collection, query, where, orderBy, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { getCategory } from '@/lib/categories'

function getWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getWeekRange() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday.toISOString(), end: sunday.toISOString() }
}

async function fetchWeeklyTransactions(uid) {
  const { start, end } = getWeekRange()
  const ref = collection(db, `users/${uid}/transactions`)
  const q = query(ref, where('createdAt', '>=', start), where('createdAt', '<=', end), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function fetchWalletNames(uid) {
  const ref = collection(db, `users/${uid}/wallets`)
  const snapshot = await getDocs(ref)
  const map = {}
  snapshot.docs.forEach((d) => {
    map[d.id] = d.data().name || 'Wallet'
  })
  return map
}

function aggregateStats(transactions, walletNames) {
  const totalSpent = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount || 0), 0)

  const byCategory = {}
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = t.category || 'Other'
    byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount || 0)
  })

  let topCategory = 'Other'
  let topCategoryAmount = 0
  Object.entries(byCategory).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategory = cat
      topCategoryAmount = amt
    }
  })

  const topCategoryPercentage = totalSpent > 0 ? Math.round((topCategoryAmount / totalSpent) * 100) : 0

  const byWallet = {}
  transactions.forEach((t) => {
    if (t.walletId) {
      const name = walletNames[t.walletId] || t.walletId
      byWallet[name] = (byWallet[name] || 0) + Number(t.amount || 0)
    }
  })

  const dailyTotals = {}
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    if (t.createdAt) {
      const day = t.createdAt.slice(0, 10)
      dailyTotals[day] = (dailyTotals[day] || 0) + Number(t.amount || 0)
    }
  })

  const daysActive = Object.keys(dailyTotals).length
  const avgDaily = daysActive > 0 ? Math.round(totalSpent / daysActive) : 0

  return {
    totalSpent,
    totalIncome,
    transactionCount: transactions.length,
    topCategory,
    topCategoryPercentage,
    byCategory,
    byWallet,
    dailyTotals,
    daysActive,
    avgDaily,
    topCategoryLabel: getCategory(topCategory).emoji + ' ' + getCategory(topCategory).labelEn,
  }
}

async function callAI(stats) {
  const res = await fetch('/api/ai/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stats }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI insights failed')
  }

  return res.json()
}

async function saveInsight(uid, weekId, data) {
  const ref = doc(db, `users/${uid}/insights`, weekId)
  await setDoc(ref, {
    ...data,
    weekId,
    generatedAt: new Date().toISOString(),
  })
}

export async function generateInsight(uid) {
  const weekId = getWeekId()
  const ref = doc(db, `users/${uid}/insights`, weekId)
  const existing = await getDoc(ref)

  if (existing.exists()) {
    return { fresh: false, data: { id: existing.id, ...existing.data() } }
  }

  const transactions = await fetchWeeklyTransactions(uid)
  const walletNames = await fetchWalletNames(uid)
  const stats = aggregateStats(transactions, walletNames)

  if (stats.transactionCount === 0) {
    const fallback = {
      totalSpent: 0,
      topCategory: 'None',
      topCategoryPercentage: 0,
      walletAnalysis: 'No transactions this week.',
      riskLevel: 'Low',
      insight: 'You had no financial activity this week.',
      recommendation: 'Start tracking your expenses to get personalized insights.',
    }
    await saveInsight(uid, weekId, fallback)
    return { fresh: true, data: { id: weekId, ...fallback }, stats }
  }

  let aiResult
  try {
    aiResult = await callAI(stats)
  } catch (err) {
    console.warn('AI insight generation failed, using fallback:', err.message)
  }

  const insight = {
    totalSpent: aiResult?.totalSpent ?? stats.totalSpent,
    topCategory: aiResult?.topCategory ?? stats.topCategory,
    topCategoryPercentage: aiResult?.topCategoryPercentage ?? stats.topCategoryPercentage,
    walletAnalysis: aiResult?.walletAnalysis || (Object.keys(stats.byWallet).length > 0
      ? `Used ${Object.keys(stats.byWallet).length} wallet(s) this week.`
      : 'No wallet data.'),
    riskLevel: aiResult?.riskLevel || (stats.totalIncome > 0 && stats.totalSpent > stats.totalIncome * 0.8 ? 'High' : stats.totalSpent > 0 ? 'Medium' : 'Low'),
    insight: aiResult?.insight || `You spent EGP ${stats.totalSpent.toLocaleString()} across ${stats.transactionCount} transaction(s) this week.`,
    recommendation: aiResult?.recommendation || 'Try to track every expense to get better AI recommendations.',
  }

  await saveInsight(uid, weekId, insight)
  return { fresh: true, data: { id: weekId, ...insight }, stats }
}

