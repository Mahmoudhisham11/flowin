const SYSTEM_PROMPT = `You are an expert financial transaction extractor specialized in Egyptian Arabic dialect (اللهجة المصرية) and English.
Extract ALL financial transactions (expenses AND income) from the user's text.

Return a JSON object with an "expenses" array:
{
  "expenses": [
    {
      "amount": number (positive, convert spoken numbers like "ميتين" to 200, "خمسمية" to 500, "ألف/باكو" to 1000, "ربع مية" to 400, "تلت مية" to 300, "خمسين" to 50, "تلاتين" to 30, etc.),
      "currency": "EGP",
      "category": string (e.g. Food, Transport, Shopping, Bills, Smoking, Entertainment, Health, Other, or a custom budget category name),
      "merchant": string (store or person name, e.g. "سوبرماركت زهران", "أوبر", "فودافون", or "" if none),
      "reason": string (short description in Arabic/English, e.g. "أكل", "مواصلات", "مرتب", "مكافأة"),
      "type": "expense" | "income" (use "income" when receiving money like "قبضت", "استلمت", "جالي", "مكافأة", "مرتب", "دخل"; use "expense" for spending like "صرفت", "دفعت", "اشتريت", "جبت"),
      "walletKeyword": string (if user mentions a wallet method like "كاش", "كارت", "فيزا", "بنك", "فودافون كاش", "إنستاباي", extract it here, else "")
    }
  ]
}

Examples:
1. "صرفت 150 أكل و 200 مواصلات و قبضت 2500 مكافأة" ->
{"expenses": [
  {"amount": 150, "currency": "EGP", "category": "Food", "merchant": "", "reason": "أكل", "type": "expense", "walletKeyword": ""},
  {"amount": 200, "currency": "EGP", "category": "Transport", "merchant": "", "reason": "مواصلات", "type": "expense", "walletKeyword": ""},
  {"amount": 2500, "currency": "EGP", "category": "Other", "merchant": "", "reason": "مكافأة", "type": "income", "walletKeyword": ""}
]}

2. "دفعت ميتين جنيه بنزين بالكارت و مية سجاير كاش" ->
{"expenses": [
  {"amount": 200, "currency": "EGP", "category": "Transport", "merchant": "", "reason": "بنزين", "type": "expense", "walletKeyword": "كارت"},
  {"amount": 100, "currency": "EGP", "category": "Smoking", "merchant": "", "reason": "سجاير", "type": "expense", "walletKeyword": "كاش"}
]}

IMPORTANT: Return ONLY valid JSON. No markdown, no commentary.`

const CONTEXT_HINTS = (budgetCategories, wallets) => {
  let hint = ''
  if (Array.isArray(budgetCategories) && budgetCategories.length > 0) {
    const list = budgetCategories.map((c) => `"${c.name}"`).join(', ')
    hint += `\nUser's budget categories: ${list}. If a word matches any of these, use the EXACT name as category.`
  }
  if (Array.isArray(wallets) && wallets.length > 0) {
    const wlist = wallets.map((w) => `"${w.name}" (id: "${w.id}", type: "${w.type}")`).join(', ')
    hint += `\nUser's wallets: ${wlist}. If a transaction mentions one of these wallets or payment types (cash/card/bank), set walletKeyword appropriately.`
  }
  return hint
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

const FREE_MODELS = [
  'minimax/minimax-m3:free',
  'openrouter/free',
]

export async function POST(req) {
  try {
    const { text, budgetCategories, wallets } = await req.json()

    if (!text || !text.trim()) {
      return Response.json({ error: 'No text provided' }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

    const hints = CONTEXT_HINTS(budgetCategories, wallets)
    let parsed = null
    let lastError = null

    for (const model of FREE_MODELS) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT + hints },
              { role: 'user', content: text },
            ],
            temperature: 0.1,
            max_tokens: 600,
          }),
        })

        if (!res.ok) {
          const errBody = await res.text().catch(() => '')
          lastError = `Model ${model} (${res.status}): ${errBody}`
          continue
        }

        const data = await res.json()
        const content = data.choices?.[0]?.message?.content || ''
        if (content) {
          parsed = extractJSON(content)
          if (parsed && Array.isArray(parsed.expenses) && parsed.expenses.length > 0) {
            break
          }
        }
      } catch (err) {
        lastError = err.message
      }
    }

    if (!parsed || !Array.isArray(parsed.expenses) || parsed.expenses.length === 0) {
      return Response.json({ error: parsed?.error || lastError || 'Could not parse any transaction from audio' })
    }

    // Map matched walletId if possible
    const enrichedExpenses = parsed.expenses.map((exp) => {
      let matchedWalletId = ''
      if (exp.walletKeyword && Array.isArray(wallets) && wallets.length > 0) {
        const kw = exp.walletKeyword.toLowerCase().trim()
        const found = wallets.find((w) =>
          w.name?.toLowerCase().includes(kw) ||
          (kw === 'كاش' && w.type === 'cash') ||
          ((kw === 'كارت' || kw === 'فيزا') && w.type === 'card') ||
          (kw === 'بنك' && w.type === 'bank')
        )
        if (found) {
          matchedWalletId = found.id
        }
      }
      return {
        ...exp,
        type: exp.type === 'income' ? 'income' : 'expense',
        walletId: matchedWalletId,
      }
    })

    return Response.json({ expenses: enrichedExpenses })
  } catch (err) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
