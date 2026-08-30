const SYSTEM_PROMPT = `You are a professional financial advisor AI. You have access to the user's real financial data as context, including their transactions, wallets, budget, and tasks. The user's name is provided in the context - use it to personalize your responses and greet them by name.

Rules:
- Answer ONLY based on the provided financial context
- Be concise, helpful, and accurate
- Use a professional but friendly tone
- Greet the user by their name at the start of your response when appropriate
- If the question is outside the scope of the provided data, politely say you can only answer based on their financial data
- Use numbers and percentages from the context when relevant
- Suggest actionable advice when appropriate
- You can analyze daily task completion rates and overdue tasks
- Tasks are persistent (they don't reset daily) and are scheduled for specific dates
- You can help users plan their tasks across the week and prioritize effectively

Return ONLY valid JSON in this exact format:
{
  "answer": string (your full response, greet the user by name when appropriate),
  "suggestions": string[] (3 follow-up questions the user might ask next),
  "confidence": number (0-1 based on how confident you are in the answer)
}

No markdown, no code fences, no extra text.`

export async function POST(req) {
  try {
    const { message, context, history } = await req.json()

    if (!message || !context) {
      return Response.json({ error: 'Message and context are required' }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY

    if (!apiKey) {
      return Response.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

    const fmt = (v) => { try { return Number(v || 0).toLocaleString() } catch { return '0' } }

    const contextBlock = `USER: ${context.userName || 'User'}

USER FINANCIAL DATA (${context.period || 'N/A'}):
- Total Balance: EGP ${fmt(context.totalBalance)}
- Total Spent: EGP ${fmt(context.totalSpent)}
- Total Income: EGP ${fmt(context.totalIncome)}
- Transactions in period: ${context.transactionCount || 0}

Spending by Category:
${Object.entries(context.categories || {})
  .map(([cat, amt]) => `  - ${cat}: EGP ${fmt(amt)}`)
  .join('\n') || '  (no data)'}

Wallet Activity:
${Object.entries(context.walletActivity || {})
  .map(([name, amt]) => `  - ${name}: EGP ${fmt(amt)}`)
  .join('\n') || '  (no data)'}

Wallets:
${(context.wallets || []).map((w) => `  - ${w.name} (${w.type || '?'}): EGP ${fmt(w.balance)}`).join('\n') || '  (no wallets)'}

${context.latestInsight ? `Latest AI Insight:
- Risk Level: ${context.latestInsight.riskLevel || 'N/A'}
- Insight: ${context.latestInsight.insight || 'N/A'}
- Recommendation: ${context.latestInsight.recommendation || 'N/A'}` : ''}

${context.budget ? `MONTHLY BUDGET PLAN:
- Monthly Income: EGP ${fmt(context.budget.monthlyIncome)}
- Total Essential Expenses: EGP ${fmt(context.budget.totalEssentials)}
- Potential Savings: EGP ${fmt((context.budget.monthlyIncome || 0) - (context.budget.totalEssentials || 0))}
- Essential Categories:
${(context.budget.essentialCategories || []).map((c) => `  - ${c.name}: EGP ${fmt(c.amount)}`).join('\n') || '  (none set)'}` : ''}

DAILY TASKS (${context.dailyTasks?.total || 0} total, ${context.dailyTasks?.completed || 0} completed):
Today (${context.dailyTasks?.todayTotal || 0} tasks, ${context.dailyTasks?.todayCompletionRate || 0}% complete):
${(context.dailyTasks?.todayItems || []).length > 0 ? context.dailyTasks.todayItems.map((t) => `  - [${t.completed ? 'x' : ' '}] ${t.title} (${t.priority}${t.time ? ', ' + t.time : ''})`).join('\n') : '  (no tasks today)'}
${context.dailyTasks?.urgent > 0 ? `  - WARNING: ${context.dailyTasks.urgent} urgent task(s) incomplete today!` : ''}
${context.dailyTasks?.overdue > 0 ? `OVERDUE TASKS (${context.dailyTasks.overdue}):
${(context.dailyTasks?.overdueItems || []).map((t) => `  - [ ] ${t.title} (${t.priority}) - scheduled: ${t.date}`).join('\n')}` : ''}
${context.dailyTasks?.upcoming > 0 ? `UPCOMING TASKS (${context.dailyTasks.upcoming}):
${(context.dailyTasks?.upcomingItems || []).map((t) => `  - [ ] ${t.title} (${t.priority}) - scheduled: ${t.date}${t.time ? ', ' + t.time : ''}`).join('\n')}` : ''}`

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: contextBlock },
    ]

    if (history && Array.isArray(history)) {
      history.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.text })
      })
    }

    messages.push({ role: 'user', content: message })

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages,
        temperature: 0.3,
        max_tokens: 800,
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

    if (first === -1 || last === -1) {
      return Response.json({
        answer: content,
        suggestions: ['How can I reduce my spending?', 'What are my biggest expenses?', 'Give me a savings tip'],
        confidence: 0.5,
      })
    }

    const parsed = JSON.parse(cleaned.slice(first, last + 1))
    return Response.json(parsed)
  } catch (err) {
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

