import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp = null

const DEFAULT_FIREBASE_PROJECT_ID = 'abodpos-1beee'
const DEFAULT_FIREBASE_CLIENT_EMAIL = 'firebase-adminsdk-fbsvc@abodpos-1beee.iam.gserviceaccount.com'
const DEFAULT_FIREBASE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDiZuTxU+2mAF4q
EHOUJTXRvgDntwP1acJJ4nhPS5zw2w1XGKczG5h8Q57L86t0jckzpcuXaHIK5H9q
8DFsvRMi4xpFsOoYVs6QKk6XKiYVdkHCdgj9sJd6epXIxa0daMYfMs3Y0Qne6TP/
8byDWFOwZ/vbF11gAa+dTp3IZHdrnv4qoG0x/umQ2Vvz6fpTRU356Z5DM5NZXSB2
sYk+Wg7WZtcwBvkY6f7v5yZG4hRwRvkdDKVLhvBDUQfttUWJiQ7XDziIMehFsdLn
7UT/14jx0+7th8cFxTn4VZML0/b9QhZ5FBwDm1MnfRKT2jvS9FCdNvce/njFzkiV
ORELkU0FAgMBAAECggEAA6Hp/3M8x2KPIDamXBSiwew+AHm/vwLE4sGW85K/gF/L
XX/gQuIo9qlxFU2iDRsvRLxewV2kIseawcD70gZQlck2BTM69kwCQW7kVumOtd5x
XKjfKQ7Zx1XLLG77gZLKRvreMaHc+i4crvkWcLcMlLJ+aHv9/Ana4ve9cVcnUVsy
d4YgILn1xakr9njjRjvbDasnFwdKhmPRPHj+V3K6J8pnQ+QrE4pp1YMy33Dnf745
BcHomjuReqaShLVHC+VfTkDiGtBP47g2dtoNfYEWSTyekxD+uyPzzQXbMMO/p7uG
SfVfJdcEXCNBvOOCAoiTT+/IqZJwo4nOo8WJD2aVkQKBgQD2gbVtpi6rauTmzAR4
gTdEQco0cvucjamMD17jjhX0frvmTOPhW5oawJKETu+glat/1aWF5dHVd8TmwKDd
GOG0/TEWklcplqPtIgXsVXEXN6MWqxwg9Nw3f7Co3tivVrG76xNpDdwuf+trOHlS
KfYjt+rC8quMHmYs1SeR7aeS3QKBgQDrHvlyfwKjw5wsNDpLIj5qu5pMbp6R9V8w
g4Iq4FU94i7iNTMrSYxsDffm1Y0v5GndWLST2/z+/LbQ4x32dS1zBMrvB2dqj2Ed
4BJbFhz4SGU8J76Yw7As9hxH4QlMZxksi2hEIiNmmFL+HZnoT58kIMz4j2NOh+Q7
BBLBO3VcSQKBgQDzaEcHG6ZPu4CFaYUsnKM+8hvBSJytDLETTQYseluxjgbqNJh8
KaB0tBy5KtyxW7j5xLPqEHHvcJFsLV9qkqwktDJpkF0jAs2hVQw2PnQqMdUHiDSB
Ume1IZAGX+3kzR05arlC7d2xyLxkpmIdwLN8t5nHoCnGdSn9MQkermXevQKBgBgd
qzRFNr4ZWDFogfom3wQPjfn89qK96i+NrZI8REH+qxRkpITyHEcQ/7ZbfQnGgd1E
NfFchQyaWx39zZrz1d+QREhUGBVj83AfBYL2N653rnqHEROWLsHN1ITC3jNJ99kL
y3wBjGP/h7Os0ZZ0ZDxOaPetrV/mrFApUMslEBqRAoGBAJULTHxz7Q/zUoR+leC1
EGDxAogAYvusdPCeN7hK4diF7LarU2GgmGAZG9UVP6vBw67AaT9r5Q+nmmV7zqby
t1VS9JO/Xi5sPbnQAjufXqhGgM5Fir4/P/zI1zsW3A79RixdWW8gjEsnxRL8a08j
auSp556OcNMt6/6qvrtni47J
-----END PRIVATE KEY-----`

/**
 * Initializes and returns the Firebase Admin SDK singleton with explicit environment validation.
 */
export function getFirebaseAdmin() {
  const existingApps = getApps()
  if (existingApps.length > 0) {
    return existingApps[0]
  }

  if (adminApp) return adminApp

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    DEFAULT_FIREBASE_PROJECT_ID

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    DEFAULT_FIREBASE_CLIENT_EMAIL

  let privateKey =
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    DEFAULT_FIREBASE_PRIVATE_KEY

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
    const app = getFirebaseAdmin()
    if (!app) {
      throw new Error('Firebase Admin could not be initialized.')
    }

    // 1. Fetch active device tokens using Admin Firestore
    const adminDb = getFirestore(app)
    const snap = await adminDb.collection(`users/${uid}/devices`).get()

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

    // 2. Get Messaging instance
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

    // 5. Clean up expired / invalid tokens using Admin Firestore
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
              cleanupPromises.push(
                adminDb.doc(`users/${uid}/devices/${staleDevice.id}`).update({
                  active: false,
                  deactivatedAt: new Date().toISOString(),
                }).catch(() => {})
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
