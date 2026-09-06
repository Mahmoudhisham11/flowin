import * as firebaseAdmin from 'firebase-admin'

const admin = firebaseAdmin.default || firebaseAdmin

function getPrivateKey() {
  const key =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY
  if (!key) return undefined
  let privateKey = key.trim()
  privateKey = privateKey.replace(/^["']|["']$/g, '')
  privateKey = privateKey.replace(/\\n/g, '\n')
  return privateKey
}

export function getFirebaseAdmin() {
  const apps = admin.apps || admin.default?.apps || []
  if (!apps || apps.length === 0) {
    const projectId =
      process.env.FIREBASE_ADMIN_PROJECT_ID ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
      'abodpos-1beee'

    const clientEmail =
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
      process.env.FIREBASE_CLIENT_EMAIL

    const privateKey = getPrivateKey()

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        `[FirebaseAdmin] Missing credentials: projectId=${!!projectId}, clientEmail=${!!clientEmail}, privateKey=${!!privateKey}`
      )
    }

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
      admin.initializeApp({ projectId })
    }
  }
  return admin
}

export const initFirebaseAdmin = getFirebaseAdmin
export { admin }
