/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: "AIzaSyBJI5Vfuoj0nDGnrodQ-3Ubs1R1s9dlJu4",
  authDomain: "abodpos-1beee.firebaseapp.com",
  projectId: "abodpos-1beee",
  storageBucket: "abodpos-1beee.firebasestorage.app",
  messagingSenderId: "606982390793",
  appId: "1:606982390793:web:2582990955f1108cf064d8",
}

firebase.initializeApp(firebaseConfig)

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload)

  const tag = payload.data?.notificationId || payload.data?.expenseId || payload.data?.tag || 'flowin-expense'
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Flowin'
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: payload.notification?.icon || '/web-app-manifest-192x192.png',
    badge: '/favicon-96x96.png',
    tag: tag,
    renotify: false,
    data: payload.data || {},
  }

  self.registration.showNotification(notificationTitle, notificationOptions)
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification?.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
