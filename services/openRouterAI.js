export async function parseExpenseFromText(text, budgetCategories = []) {
  const res = await fetch('/api/ai/parse-expense', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, budgetCategories }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'AI parsing failed')
  }

  return res.json()
}

