import { db } from '@/lib/firestore'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'

function getLast30DaysRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  return { start: start.toISOString(), end: end.toISOString() }
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

export async function buildChatContext(uid, userName) {
  const { start, end } = getLast30DaysRange()
  const ref = collection(db, `users/${uid}/transactions`)
  const q = query(ref, where('createdAt', '>=', start), where('createdAt', '<=', end), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  const transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const walletSnap = await getDocs(collection(db, `users/${uid}/wallets`))
  const wallets = walletSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const weekId = getCurrentWeekId()
  const insightRef = doc(db, `users/${uid}/insights`, weekId)
  const insightSnap = await getDoc(insightRef)
  const insight = insightSnap.exists() ? insightSnap.data() : null

  const budgetRef = doc(db, `users/${uid}/budget/config`)
  const budgetSnap = await getDoc(budgetRef)
  const budget = budgetSnap.exists() ? budgetSnap.data() : null

  const goalsSnap = await getDocs(collection(db, `users/${uid}/goals`))
  const goals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const today = getTodayDate()
  const tasksQ = query(collection(db, `users/${uid}/dailyTasks`), where('date', '==', today))
  const tasksSnap = await getDocs(tasksQ)
  const dailyTasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const projectsSnap = await getDocs(collection(db, `users/${uid}/projects`))
  const projects = projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const totalSpent = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0)

  const byCategory = {}
  transactions.filter((t) => t.type === 'expense').forEach((t) => {
    const cat = t.category || 'Other'
    byCategory[cat] = (byCategory[cat] || 0) + Number(t.amount || 0)
  })

  const byWallet = {}
  transactions.forEach((t) => {
    if (t.walletId) {
      const w = wallets.find((x) => x.id === t.walletId)
      const name = w?.name || t.walletId
      byWallet[name] = (byWallet[name] || 0) + Number(t.amount || 0)
    }
  })

  const overdueGoals = goals.filter((g) => g.deadline && new Date(g.deadline) < new Date() && (g.saved || 0) < g.targetAmount)
  const completedTasks = dailyTasks.filter((t) => t.completed).length
  const completedProjects = projects.filter((p) => p.status === 'completed').length
  const overdueProjects = projects.filter((p) => p.deadline && new Date(p.deadline) < new Date() && p.status !== 'completed')

  return {
    userName: userName || 'User',
    period: 'Last 30 days',
    totalBalance,
    totalSpent,
    totalIncome,
    transactionCount: transactions.length,
    categories: byCategory,
    walletActivity: byWallet,
    wallets: wallets.map((w) => ({ name: w.name, balance: w.balance, type: w.type })),
    latestInsight: insight ? {
      riskLevel: insight.riskLevel,
      insight: insight.insight,
      recommendation: insight.recommendation,
    } : null,
    budget: budget ? {
      monthlyIncome: budget.monthlyIncome || 0,
      essentialCategories: (budget.essentialCategories || []).map((c) => ({ name: c.name, amount: c.amount })),
      totalEssentials: (budget.essentialCategories || []).reduce((s, c) => s + Number(c.amount || 0), 0),
    } : null,
    goals: {
      total: goals.length,
      overdue: overdueGoals.length,
      items: goals.map((g) => ({
        name: g.name,
        target: g.targetAmount,
        saved: g.saved || 0,
        progress: g.targetAmount > 0 ? Math.round(((g.saved || 0) / g.targetAmount) * 100) : 0,
        deadline: g.deadline,
        overdue: g.deadline && new Date(g.deadline) < new Date() && (g.saved || 0) < g.targetAmount,
      })),
    },
    dailyTasks: {
      total: dailyTasks.length,
      completed: completedTasks,
      completionRate: dailyTasks.length > 0 ? Math.round((completedTasks / dailyTasks.length) * 100) : 0,
      urgent: dailyTasks.filter((t) => t.priority === 'urgent' && !t.completed).length,
      items: dailyTasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        completed: t.completed,
        time: t.time,
      })),
    },
    projects: {
      total: projects.length,
      completed: completedProjects,
      overdue: overdueProjects.length,
      items: projects.map((p) => ({
        name: p.name,
        progress: p.progress || 0,
        deadline: p.deadline,
        status: p.status,
      })),
    },
  }
}

function getCurrentWeekId() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
