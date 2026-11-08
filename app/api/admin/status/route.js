import { getAdminFirestore } from '@/lib/firebaseAdmin'
import { requireAdmin, errorResponse } from '@/lib/serverAuth'
import { rateLimit } from '@/lib/rateLimit'
import { PRO_PRICE } from '@/lib/plans'

export const maxDuration = 60

// Only booleans and non-secret settings are returned, never a value that is a secret.
const has = (...names) => names.some((n) => Boolean(process.env[n]))

export async function GET(req) {
  try {
    await requireAdmin(req)

    // Can the server read the database with the configured credentials?
    let firestore
    const started = Date.now()
    try {
      await getAdminFirestore().collection('users').limit(1).get()
      firestore = { ok: true, ms: Date.now() - started }
    } catch (err) {
      firestore = { ok: false, error: String(err?.code || err?.message || 'error').slice(0, 120) }
    }

    return Response.json({
      success: true,
      checks: {
        firebaseProjectId: has('FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
        firebaseClientEmail: has('FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_CLIENT_EMAIL'),
        firebasePrivateKey: has('FIREBASE_ADMIN_PRIVATE_KEY', 'FIREBASE_PRIVATE_KEY'),
        firestore,
        openRouterKey: has('OPENROUTER_API_KEY'),
        vapidKey: has('NEXT_PUBLIC_FIREBASE_VAPID_KEY'),
        appUrl: has('NEXT_PUBLIC_APP_URL'),
        supportEmail: has('NEXT_PUBLIC_SUPPORT_EMAIL'),
      },
      info: {
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
        proPrice: Number(process.env.PRO_PRICE_EGP) || Number(PRO_PRICE),
        aiChatDailyLimit: Number(process.env.AI_CHAT_DAILY_LIMIT) > 0 ? Number(process.env.AI_CHAT_DAILY_LIMIT) : 40,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}

// POST { test: 'ai' }: sends one tiny request to the AI provider and reports whether it answered.
export async function POST(req) {
  try {
    const { uid } = await requireAdmin(req)
    rateLimit(`admin-ai-test:${uid}`, 5, 60_000)

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) return Response.json({ success: true, ok: false, error: 'OPENROUTER_API_KEY is not set' })

    const started = Date.now()
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
          max_tokens: 20,
          temperature: 0,
        }),
      })
      const ms = Date.now() - started
      if (!res.ok) {
        // OpenRouter explains key and quota problems in the body (e.g. invalid key, rate limit).
        const body = await res.json().catch(() => ({}))
        return Response.json({ success: true, ok: false, status: res.status, ms, error: String(body?.error?.message || `HTTP ${res.status}`).slice(0, 200) })
      }
      const data = await res.json()
      const reply = String(data?.choices?.[0]?.message?.content || '').trim().slice(0, 80)
      return Response.json({ success: true, ok: Boolean(reply), status: res.status, ms, model: data?.model || null, reply, error: reply ? null : 'The model returned an empty answer' })
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      return Response.json({ success: true, ok: false, ms: Date.now() - started, error: timedOut ? 'Timed out after 30 seconds' : String(err?.message || 'Request failed').slice(0, 200) })
    }
  } catch (err) {
    return errorResponse(err)
  }
}
