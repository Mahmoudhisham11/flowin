const SYSTEM_PROMPT = `You are a financial assistant. Extract ALL expense/income items from the user's text. The text may be in Arabic or English.

Return a JSON object with an "expenses" array. Each expense object:
{
  "amount": number (positive),
  "currency": "EGP",
  "category": string,
  "merchant": string (or "" if unknown),
  "type": "expense" | "income",
  "confidence": number 0-1
}

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no extra text before or after.

Example for "صرفت 200 جنيه اكل و 100 سجاير و 50 مواصلات":
{"expenses": [{"amount":200,"currency":"EGP","category":"Food","merchant":"","type":"expense","confidence":0.9},{"amount":100,"currency":"EGP","category":"Smoking","merchant":"","type":"expense","confidence":0.9},{"amount":50,"currency":"EGP","category":"Transport","merchant":"","type":"expense","confidence":0.9}]}

If you cannot parse anything, return: {"expenses": [], "error": "Could not parse any expense"}`

const BUDGET_HINT = (categories) => {
  if (!Array.isArray(categories) || categories.length === 0) return ''
  const list = categories.map((c) => `"${c.name}"`).join(', ')
  return `

The user has defined these budget categories: ${list}.
When a word or phrase in the user's text matches one of these budget categories, use its EXACT name as the category value (case-sensitive). For example, if a budget category is "مواصلات" and the user says "مواصلات", set category to "مواصلات".
Otherwise, use one of the general English category IDs: Food, Transport, Shopping, Bills, Smoking, Entertainment, Health, Other.`
}

function extractJSON(raw) {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1))
  }
  return JSON.parse(cleaned)
}

export async function POST(req) {
  try {
    const { text, budgetCategories } = await req.json()

    if (!text || !text.trim()) {
      return Response.json({ error: 'No text provided' }, { status: 400 })
    }

    const budgetHint = BUDGET_HINT(budgetCategories)

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return Response.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + budgetHint },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return Response.json({ error: `OpenRouter API error: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''

    if (!content) {
      return Response.json({ error: 'AI returned empty response' }, { status: 502 })
    }

    const parsed = extractJSON(content)

    if (parsed.error) {
      return Response.json({ error: parsed.error })
    }

    if (!Array.isArray(parsed.expenses) || parsed.expenses.length === 0) {
      return Response.json({ error: 'Could not parse any expense' })
    }

    return Response.json({ expenses: parsed.expenses })
  } catch (err) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

