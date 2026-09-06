import admin from 'firebase-admin'

function formatPrivateKey(key) {
  if (!key) return undefined
  return key.replace(/\\n/g, '\n')
}

export function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'abodpos-1beee'
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY)

    if (clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        })
      } catch (err) {
        console.error('Firebase Admin Cert Init Error:', err)
        admin.initializeApp({ projectId })
      }
    } else {
      admin.initializeApp({
        projectId,
      })
    }
  }
  return admin
}

export { admin }
