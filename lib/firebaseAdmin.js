import admin from 'firebase-admin'

function formatPrivateKey(key) {
  if (!key) return undefined
  let privateKey = key.trim()
  // إزالة أي علامات تنصيص في البداية والنهاية
  privateKey = privateKey.replace(/^["']|["']$/g, '')
  // معالجة الأسطر الجديدة سواء كانت مشفرة كـ \\n أو \n
  privateKey = privateKey.replace(/\\n/g, '\n')
  return privateKey
}

export function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'abodpos-1beee'

    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL

    const rawPrivateKey =
      process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
      process.env.FIREBASE_PRIVATE_KEY

    const privateKey = formatPrivateKey(rawPrivateKey)

    if (clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
        console.log('[FirebaseAdmin] Initialized successfully with cert for project:', projectId)
      } catch (err) {
        console.error('[FirebaseAdmin] Initialization with cert failed:', err.message)
        throw new Error(`Firebase Admin cert initialization failed: ${err.message}`)
      }
    } else {
      console.warn(
        '[FirebaseAdmin] Missing clientEmail or privateKey. clientEmail exists:',
        Boolean(clientEmail),
        'privateKey exists:',
        Boolean(privateKey)
      )
      admin.initializeApp({ projectId })
    }
  }
  return admin
}

export { admin }
