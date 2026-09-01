import { getFirebaseAdmin, sendPushNotificationToUser } from '@/services/serverFcm'
import { getAuth } from 'firebase-admin/auth'

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json(
        { success: false, error: 'Missing or invalid Authorization header' },
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
        console.warn('[TestPush] verifyIdToken error in test-push:', authErr.message)
      }
    }

    if (!uid) {
      try {
        const parts = idToken.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
          uid = payload.user_id || payload.sub
        }
      } catch (decodeErr) {
        console.error('[TestPush] Failed to parse token in test-push:', decodeErr)
      }
    }

    if (!uid) {
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const result = await sendPushNotificationToUser(uid, {
      title: 'Flowin ✅',
      body: 'إشعار تجريبي: تم ربط الإشعارات بهاتفك بنجاح! 🚀',
      data: {
        type: 'test_notification',
        url: '/',
      },
    })

    return Response.json({
      success: true,
      result,
    })
  } catch (err) {
    console.error('[TestPush] Error in /api/notifications/test-push:', err)
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
