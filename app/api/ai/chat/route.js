import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requirePaidUser, errorResponse, HttpError } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { resolveTimezone, localDateStr } from '@/lib/timezone'
import { getQuota, consumeQuota } from '@/lib/aiQuota'
import { loadChatData } from '@/lib/chatData'
import { formatChatContext } from '@/lib/chatContext'
import { systemPrompt, parseModelAnswer } from '@/lib/chatPrompt'
import { normalizeCurrency } from '@/lib/currency'

const MODEL = 'openrouter/free'
const MAX_MESSAGE = 2000

// Remaining messages for today (shown under the chat input).
export async function GET(req) {
  try {
    const { uid, userData } = await requirePaidUser(req)
    const tz = resolveTimezone(userData.timezone)
    const quota = await getQuota(uid, userData, localDateStr(tz))
    return Response.json({ success: true, quota })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function POST(req) {
  try {
    const { uid, userData } = await requirePaidUser(req)
    rateLimit(`ai-chat:${uid}`, 15, 60_000)

    const body = await req.json().catch(() => ({}))
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : ''
    if (!message) throw new HttpError(400, 'Message is required')
    const lang = body.lang === 'en' ? 'en' : 'ar'

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new HttpError(500, 'AI is not configured')

    const tz = resolveTimezone(body.timezone || userData.timezone)
    const day = localDateStr(tz)

    // Fail fast (without spending a message) when today's limit is already used up.
    const before = await getQuota(uid, userData, day)
    if (before.remaining === 0) throw new HttpError(429, 'DAILY_LIMIT')

    // Everything the model knows comes from the database, never from the browser.
    const db = getAdminFirestore()
    const data = await loadChatData(db, uid, userData, tz)
    const firstName = String(userData.name || '').trim().split(/\s+/)[0]
    const context = formatChatContext({ ...data, firstName, currency: normalizeCurrency(userData.currency) })

    const messages = [
      { role: 'system', content: systemPrompt(lang) },
      { role: 'system', content: context },
    ]
    // Only user/assistant turns from the client (never 'system'), bounded in number and size.
    if (Array.isArray(body.history)) {
      body.history.slice(-10).forEach((m) => {
        if ((m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string') {
          messages.push({ role: m.role, content: m.text.slice(0, 1500) })
        }
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
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, max_tokens: 900 }),
    })

    if (!res.ok) {
      console.error('[ai/chat] OpenRouter error:', res.status)
      throw new HttpError(502, 'The AI service is busy. Please try again.')
    }

    const completion = await res.json()
    const parsed = parseModelAnswer(completion.choices?.[0]?.message?.content, lang)
    if (!parsed) throw new HttpError(502, 'The AI returned an empty answer. Please try again.')

    // Only a delivered answer costs a message.
    const quota = await consumeQuota(uid, userData, day)
    return Response.json({ success: true, ...parsed, quota })
  } catch (err) {
    if (err instanceof HttpError && err.message === 'DAILY_LIMIT') {
      return Response.json({ success: false, code: 'DAILY_LIMIT', error: 'You reached today’s message limit.' }, { status: 429 })
    }
    return errorResponse(err)
  }
}
