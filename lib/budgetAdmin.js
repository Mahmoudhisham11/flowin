import { findMatchingCategory } from './budgetMatch'

/** Server-side (admin SDK) equivalent of budgetService.deductFromBudget, run in a transaction. */
export async function deductFromBudgetAdmin(db, uid, categoryName, amount) {
  const ref = db.doc(`users/${uid}/budget/config`)
  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref)
      if (!snap.exists) return

      const categories = (snap.data().essentialCategories || []).map((c) => ({ ...c }))
      if (categories.length === 0) return

      const match = findMatchingCategory(categories, categoryName)
      if (!match) return

      match.spent = (Number(match.spent) || 0) + Number(amount)
      t.update(ref, {
        essentialCategories: categories,
        updatedAt: new Date().toISOString(),
      })
    })
  } catch (err) {
    console.error('deductFromBudgetAdmin error:', err)
  }
}
