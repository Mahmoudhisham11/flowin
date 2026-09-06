'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getMessagingInstance } from '@/lib/firebase'
import { db } from '@/lib/firestore'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'

export function useFCM(user) {
  const [token, setToken] = useState(null)
  const [permission, setPermission] = useState('default')
  const [foregroundNotification, setForegroundNotification] = useState(null)
  const [loading, setLoading] = useState(false)
  const registeredRef = useRef(false)

  // Save token in Firestore subcollection for the current user & device
  const saveTokenToFirestore = useCallback(async (uid, fcmToken) => {
    if (!uid || !fcmToken) return
    try {
      // Safe ID for token document (replace illegal Firestore characters)
      const tokenKey = fcmToken.replace(/[/.]/g, '_').slice(-80)
      const tokenDocRef = doc(db, `users/${uid}/fcm_tokens`, tokenKey)

      const isMobile = typeof navigator !== 'undefined' ? /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) : false
      const platformName = typeof navigator !== 'undefined' ? (navigator.userAgentData?.platform || navigator.platform || 'web') : 'web'

      await setDoc(tokenDocRef, {
        token: fcmToken,
        deviceType: isMobile ? 'mobile' : 'desktop',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        platform: platformName,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true })

      // Also update latest token on user profile
      const userRef = doc(db, 'users', uid)
      await updateDoc(userRef, {
        fcmToken,
        fcmUpdatedAt: serverTimestamp(),
      }).catch(async () => {
        await setDoc(userRef, {
          fcmToken,
          fcmUpdatedAt: serverTimestamp(),
        }, { merge: true })
      })

      console.log('[useFCM] Token saved for device:', isMobile ? 'mobile' : 'desktop')
    } catch (err) {
      console.error('[useFCM] Error saving token to Firestore:', err)
    }
  }, [])

  // Request permission & fetch token
  const requestNotificationPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Notifications or Service Workers are not supported in this environment.')
      return null
    }

    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        console.log('Notification permission was not granted:', perm)
        setLoading(false)
        return null
      }

      // Register or get active Service Worker registration
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      })
      await navigator.serviceWorker.ready

      const messaging = await getMessagingInstance()
      if (!messaging) {
        setLoading(false)
        return null
      }

      const { getToken } = await import('firebase/messaging')
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })

      if (currentToken) {
        setToken(currentToken)
        if (user?.uid) {
          await saveTokenToFirestore(user.uid, currentToken)
        }
        setLoading(false)
        return currentToken
      } else {
        console.warn('No registration token available. Request permission to generate one.')
      }
    } catch (err) {
      console.error('An error occurred while retrieving FCM token:', err)
    } finally {
      setLoading(false)
    }
    return null
  }, [user?.uid, saveTokenToFirestore])

  // Initialize and listen for foreground messages
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    setPermission(Notification.permission)

    let unsubscribe = null

    const initMessaging = async () => {
      // Auto-fetch token if permission is already granted and user is logged in
      if (Notification.permission === 'granted' && user?.uid && !registeredRef.current) {
        registeredRef.current = true
        requestNotificationPermission()
      }

      const messaging = await getMessagingInstance()
      if (!messaging) return

      try {
        const { onMessage } = await import('firebase/messaging')
        unsubscribe = onMessage(messaging, (payload) => {
          console.log('[useFCM] Foreground message received:', payload)

          const notificationData = {
            title: payload.notification?.title || payload.data?.title || 'Flowin',
            body: payload.notification?.body || payload.data?.body || '',
            icon: payload.notification?.icon || '/web-app-manifest-192x192.png',
            data: payload.data || {},
            id: Date.now(),
          }

          setForegroundNotification(notificationData)
        })
      } catch (err) {
        console.error('Error setting up onMessage listener:', err)
      }
    }

    initMessaging()

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [user?.uid, requestNotificationPermission])

  const clearNotification = () => setForegroundNotification(null)

  return {
    token,
    permission,
    loading,
    foregroundNotification,
    clearNotification,
    requestNotificationPermission,
  }
}
