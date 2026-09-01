import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { db } from '@/lib/firestore'
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore'

let adminApp = null

/**
 * Initializes and returns the Firebase Admin SDK singleton with explicit environment validation.
 */
export function getFirebaseAdmin() {
  const existingApps = getApps()
  if (existingApps.length > 0) {
    return existingApps[0]
  }

  if (adminApp) return adminApp

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || 'abodpos-1beee'
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (!clientEmail || !privateKey) {
    console.warn(
      '[FCM Server] Warning: FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY is missing in environment variables. Web Push sending might fail.'
    )
  }

  if (privateKey) {
    // Handle escaped newlines in environment variables or surrounding quotes
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
  }

  if (clientEmail && privateKey) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      return adminApp
    } catch (err) {
      console.error('[FCM Server] Error initializing Firebase Admin certificate:', err)
    }
  }

  // Fallback: initializeApp without explicit cert
  try {
    adminApp = initializeApp({
      projectId,
    })
    return adminApp
  } catch (err) {
    console.warn('[FCM Server] Firebase Admin fallback initialization error:', err.message)
    return null
  }
}

/**
 * Sends FCM Web Push notification to all active devices registered for a user.
 * 
 * @param {string} uid User ID
 * @param {Object} payload { title, body, data }
 * @returns {Promise<{ success: boolean, sentCount?: number, error?: string }>}
 */
export async function sendPushNotificationToUser(uid, payload) {
  if (!uid) return { success: false, error: 'User ID is required' }

  try {
    // 1. Fetch active device tokens from Firestore
    const devicesRef = collection(db, `users/${uid}/devices`)
    const snap = await getDocs(devicesRef)

    if (snap.empty) {
      console.log(`[FCM Server] No registered devices found for user ${uid}`)
      return { success: true, sentCount: 0, message: 'No registered devices' }
    }

    const deviceDocs = []
    const tokens = []

    snap.docs.forEach((d) => {
      const data = d.data()
      if (data.active !== false && data.token) {
        tokens.push(data.token)
        deviceDocs.push({ id: d.id, token: data.token })
      }
    })

    if (tokens.length === 0) {
      console.log(`[FCM Server] No active FCM tokens for user ${uid}`)
      return { success: true, sentCount: 0, message: 'No active tokens' }
    }

    // 2. Initialize Firebase Admin and get Messaging instance
    const app = getFirebaseAdmin()
    if (!app) {
      throw new Error('Firebase Admin could not be initialized. Please check FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL.')
    }

    const messaging = getMessaging(app)

    // 3. Prepare Multicast Message
    const title = payload.title || 'Flowin ✅'
    const body = payload.body || 'تم تسجيل المعاملة بنجاح'
    const targetUrl = payload.data?.url || '/'

    const message = {
      tokens,
      notification: {
        title,
        body,
      },
      data: {
        url: targetUrl,
        ...(payload.data || {}),
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title,
          body,
          icon: '/web-app-manifest-192x192.png',
          badge: '/favicon-96x96.png',
          tag: payload.data?.type || 'flowin-notification',
          renotify: true,
        },
        fcmOptions: {
          link: targetUrl,
        },
      },
    }

    // 4. Send via Firebase Admin Messaging
    const response = await messaging.sendEachForMulticast(message)
    console.log(`[FCM Server] Push send result for user ${uid}: ${response.successCount} success, ${response.failureCount} failed`)

    // 5. Clean up expired / invalid tokens
    if (response.failureCount > 0) {
      const cleanupPromises = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code
          console.warn(`[FCM Server] Token send error (${errorCode}):`, resp.error?.message)
          
          if (
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-registration-token'
          ) {
            const staleDevice = deviceDocs[idx]
            if (staleDevice) {
              const staleDocRef = doc(db, `users/${uid}/devices`, staleDevice.id)
              cleanupPromises.push(
                updateDoc(staleDocRef, { active: false, deactivatedAt: new Date().toISOString() }).catch(() => {})
              )
            }
          }
        }
      })
      await Promise.all(cleanupPromises)
    }

    return {
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
    }
  } catch (err) {
    console.error(`[FCM Server] Failed to send push notification to user ${uid}:`, err)
    return {
      success: false,
      error: err.message || 'Failed to send notification',
    }
  }
}
