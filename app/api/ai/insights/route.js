const SYSTEM_PROMPT = `You are a financial analyst. Given a user's aggregated weekly financial data, generate a JSON insight.

Rules:
- Be concise, practical, and encouraging
- insight: 1-2 sentences about their spending behavior
- recommendation: 1 specific actionable tip
- walletAnalysis: 1 sentence about wallet usage / balance trend
- riskLevel: "Low" if spending < 50% of income, "Medium" if 50-80%, "High" if > 80%
- If no income data, compare spending against previous week pattern

Return ONLY valid JSON:
{
  "totalSpent": number,
  "topCategory": string,
  "topCategoryPercentage": number,
  "walletAnalysis": string,
  "riskLevel": "Low | Medium | High",
  "insight": string,
  "recommendation": string
}

No markdown, no code fences, no extra text.`

export async function POST(req) {
  try {
    const { stats } = await req.json()

    if (!stats) {
      return Response.json({ error: 'No stats provided' }, { status: 400 })
    }

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
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(stats, null, 2) },
        ],
        temperature: 0.3,
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

    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    const parsed = JSON.parse(first !== -1 && last !== -1 ? cleaned.slice(first, last + 1) : cleaned)

    return Response.json(parsed)
  } catch (err) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

