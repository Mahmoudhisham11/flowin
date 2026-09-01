import admin from 'firebase-admin'
import { db } from '@/lib/firestore'
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'

let adminApp = null

/**
 * Initializes and returns the Firebase Admin SDK singleton.
 */
export function getFirebaseAdmin() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.apps[0]
  }

  if (adminApp) return adminApp

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || 'abodpos-1beee'
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (privateKey) {
    // Handle escaped newlines in environment variables
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  if (clientEmail && privateKey) {
    try {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      })
      return adminApp
    } catch (err) {
      console.error('Error initializing Firebase Admin with certificate:', err)
    }
  }

  // Fallback: try initializeApp without explicit cert (for environments with GOOGLE_APPLICATION_CREDENTIALS)
  try {
    adminApp = admin.initializeApp({
      projectId,
    })
    return adminApp
  } catch (err) {
    console.warn('Firebase Admin initialized without credentials (FCM send might require service account credentials):', err.message)
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
      console.log(`[serverFcm] No registered devices found for user ${uid}`)
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
      console.log(`[serverFcm] No active FCM tokens for user ${uid}`)
      return { success: true, sentCount: 0, message: 'No active tokens' }
    }

    // 2. Initialize Firebase Admin
    getFirebaseAdmin()

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
    const response = await admin.messaging().sendEachForMulticast(message)
    console.log(`[serverFcm] FCM Send result for ${uid}: ${response.successCount} success, ${response.failureCount} failed`)

    // 5. Clean up expired / invalid tokens
    if (response.failureCount > 0) {
      const cleanupPromises = []
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code
          console.warn(`[serverFcm] Token send error (${errorCode}):`, resp.error?.message)
          
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
    console.error(`[serverFcm] Failed to send push notification to user ${uid}:`, err)
    return {
      success: false,
      error: err.message || 'Failed to send notification',
    }
  }
}
