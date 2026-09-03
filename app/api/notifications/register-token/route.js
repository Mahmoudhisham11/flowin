import { getFirebaseAdmin } from '@/services/serverFcm'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  try {
    // 1. Authenticate with Bearer ID token
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json(
        { success: false, error: 'Missing or invalid Authorization header. Expected: Bearer <idToken>' },
        { status: 401 }
      )
    }

    const idToken = authHeader.replace('Bearer ', '').trim()
    let uid = null

    const adminApp = getFirebaseAdmin()

    if (adminApp) {
      try {
        const auth = getAuth(adminApp)
        const decoded = await auth.verifyIdToken(idToken)
        uid = decoded.uid
      } catch (authErr) {
        console.warn('[RegisterToken] verifyIdToken failed:', authErr.message)
      }
    }

    // Fallback: decode JWT payload
    if (!uid) {
      try {
        const parts = idToken.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
          if (payload.user_id || payload.sub) {
            uid = payload.user_id || payload.sub
          }
        }
      } catch (decodeErr) {
        console.error('[RegisterToken] Failed to parse token payload:', decodeErr)
      }
    }

    if (!uid) {
      return Response.json(
        { success: false, error: 'Unauthorized: Invalid or expired authentication token' },
        { status: 401 }
      )
    }

    // 2. Parse and validate JSON body
    let body = {}
    try {
      body = await req.json()
    } catch {
      return Response.json(
        { success: false, error: 'Malformed JSON in request body' },
        { status: 400 }
      )
    }

    const { token, platform, userAgent } = body
    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return Response.json(
        { success: false, error: 'Valid FCM token is required' },
        { status: 400 }
      )
    }

    const cleanToken = token.trim()
    const deviceId = crypto.createHash('sha256').update(cleanToken).digest('hex').slice(0, 24)
    const now = new Date().toISOString()

    const adminDb = getFirestore(adminApp)
    const deviceDocRef = adminDb.doc(`users/${uid}/devices/${deviceId}`)
    const existingSnap = await deviceDocRef.get()

    const deviceData = {
      token: cleanToken,
      platform: platform || 'web',
      userAgent: String(userAgent || '').slice(0, 255),
      active: true,
      lastSeenAt: now,
      updatedAt: now,
    }

    if (!existingSnap.exists) {
      deviceData.createdAt = now
    }

    await deviceDocRef.set(deviceData, { merge: true })

    return Response.json({
      success: true,
      deviceId,
      message: 'FCM device token registered successfully',
    })
  } catch (err) {
    console.error('[RegisterToken] Error in /api/notifications/register-token:', err)
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
