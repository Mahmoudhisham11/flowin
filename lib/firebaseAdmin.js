import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

function getPrivateKey() {
  const key =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY

  if (!key) return undefined
  return key.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n')
}

export function initAdmin() {
  const apps = getApps()
  if (!apps.length) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      'abodpos-1beee'

    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL

    const privateKey = getPrivateKey()

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        `Missing Firebase Admin environment variables: projectId=${!!projectId}, clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`
      )
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  }
  return apps[0]
}

export function getAdminMessaging() {
  initAdmin()
  return getMessaging()
}

export function getAdminFirestore() {
  initAdmin()
  return getFirestore()
}
