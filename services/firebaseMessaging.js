import { app } from '@/lib/firebase'

let messagingInstance = null

/**
 * Checks if Web Push notifications are supported in current browser/environment.
 */
export async function isPushNotificationSupported() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    const { isSupported } = await import('firebase/messaging')
    return await isSupported()
  } catch (err) {
    console.warn('isSupported check failed:', err)
    return false
  }
}

/**
 * Gets current notification permission state: 'granted' | 'denied' | 'default' | 'unsupported'
 */
export function getNotificationPermissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Lazily initializes and returns Firebase Messaging instance.
 */
export async function getMessagingInstance() {
  if (typeof window === 'undefined') return null
  if (messagingInstance) return messagingInstance

  const supported = await isPushNotificationSupported()
  if (!supported) return null

  try {
    const { getMessaging } = await import('firebase/messaging')
    messagingInstance = getMessaging(app)
    return messagingInstance
  } catch (err) {
    console.error('Failed to get Firebase Messaging instance:', err)
    return null
  }
}

/**
 * Requests permission, registers service worker, and retrieves FCM Token.
 */
export async function requestAndGetFcmToken(customVapidKey) {
  if (typeof window === 'undefined') {
    throw new Error('Push notifications can only be initialized in browser')
  }

  const supported = await isPushNotificationSupported()
  if (!supported) {
    throw new Error('Web Push notifications are not supported on this browser or platform.')
  }

  // 1. Request Permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notification permission was denied.' : 'Notification permission was dismissed.')
  }

  // 2. Register FCM Service Worker
  let swRegistration
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      })
      await navigator.serviceWorker.ready
    } catch (swErr) {
      console.warn('Custom SW registration error, trying default:', swErr)
    }
  }

  // 3. Get Messaging Instance & Token
  const messaging = await getMessagingInstance()
  if (!messaging) {
    throw new Error('Firebase Messaging is not available')
  }

  const DEFAULT_VAPID_KEY =
    'BF6POyd5Xfi_9JlJAnOI3qWKMaVsgcab-FcRGgHWM8n_YT_GORygy5YtSIYSJJknq8EcoCf4FW60x7tQptczylY'

  // Helper to sanitize any raw key string
  const cleanKeyString = (raw) => {
    if (!raw || typeof raw !== 'string') return ''
    let key = raw.trim()
    // Remove wrapping single or double quotes
    key = key.replace(/^['"]+|['"]+$/g, '').trim()
    // If accidentally pasted with KEY=VALUE format
    if (key.includes('=')) {
      const parts = key.split('=')
      key = parts[parts.length - 1].trim().replace(/^['"]+|['"]+$/g, '').trim()
    }
    // Remove any embedded whitespace/newlines
    key = key.replace(/\s+/g, '')
    return key
  }

  let vapidKey =
    cleanKeyString(customVapidKey) ||
    cleanKeyString(process.env.NEXT_PUBLIC_FCM_VAPID_KEY) ||
    cleanKeyString(process.env.NEXT_PUBLIC_VAPID_KEY) ||
    cleanKeyString(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) ||
    DEFAULT_VAPID_KEY

  if (!vapidKey || vapidKey.length < 30) {
    vapidKey = DEFAULT_VAPID_KEY
  }

  const { getToken } = await import('firebase/messaging')

  let token = null
  try {
    token = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: swRegistration,
    })
  } catch (firstErr) {
    console.warn('[FCM] First getToken attempt failed, cleaning subscription and retrying with default key:', firstErr)

    // Unsubscribe any stale push subscription that might conflict with the key
    if (swRegistration && 'pushManager' in swRegistration) {
      try {
        const existingSub = await swRegistration.pushManager.getSubscription()
        if (existingSub) {
          await existingSub.unsubscribe()
        }
      } catch (unsubErr) {
        console.warn('[FCM] Error unsubscribing stale push subscription:', unsubErr)
      }
    }

    // Retry with DEFAULT_VAPID_KEY
    token = await getToken(messaging, {
      vapidKey: DEFAULT_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    })
  }

  if (!token) {
    throw new Error('No registration token available. Please check VAPID key configuration.')
  }

  return token
}

/**
 * Sends token to backend to be stored in users/{uid}/devices/{deviceId}.
 */
export async function registerDeviceToken(fcmToken, idToken) {
  if (!fcmToken) return { success: false, error: 'Token is required' }

  try {
    const res = await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        token: fcmToken,
        platform: 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
    })

    const data = await res.json()
    return data
  } catch (err) {
    console.error('Failed to register device token with backend:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Listens for foreground push messages when Flowin is open.
 */
export async function subscribeToForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}

  try {
    const { onMessage } = await import('firebase/messaging')
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[Foreground FCM message]:', payload)
      if (typeof callback === 'function') {
        callback(payload)
      }
    })
    return unsubscribe
  } catch (err) {
    console.error('Error subscribing to foreground messages:', err)
    return () => {}
  }
}
