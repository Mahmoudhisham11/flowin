import { db } from '@/lib/firestore'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'

// Safe SHA-256 hashing for both Node.js (API routes) and Browser (React components)
export async function hashToken(rawToken) {
  const token = String(rawToken || '').trim()
  if (!token) return ''

  if (typeof window === 'undefined') {
    // Node.js server environment
    const crypto = await import('crypto')
    return crypto.createHash('sha256').update(token).digest('hex')
  } else {
    // Browser environment
    const encoder = new TextEncoder()
    const data = encoder.encode(token)
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}

// Generate random secure token string
export function generateTokenString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'flw_sec_'
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(24)
    window.crypto.getRandomValues(array)
    for (let i = 0; i < 24; i++) {
      result += chars[array[i] % chars.length]
    }
  } else {
    // Server or fallback
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  }
  return result
}

/**
 * Creates or regenerates a Quick Expense Personal API Token for a user.
 * Returns the RAW token (displayed only ONCE).
 * Stores only the SHA-256 hash in Firestore.
 */
export async function createQuickExpenseToken(uid) {
  if (!uid) throw new Error('User ID is required')

  // 1. Revoke any existing active tokens for this user first
  await revokeQuickExpenseToken(uid)

  // 2. Generate new raw token
  const rawToken = generateTokenString()
  const tokenHash = await hashToken(rawToken)
  const prefix = rawToken.slice(0, 12) + '...'

  const now = new Date().toISOString()

  // 3. Store hash in quick_expense_tokens collection
  const tokenDocRef = doc(db, 'quick_expense_tokens', tokenHash)
  await setDoc(tokenDocRef, {
    uid,
    tokenHash,
    prefix,
    createdAt: now,
    lastUsedAt: null,
    active: true,
  })

  // 4. Update user metadata
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    quickExpenseToken: {
      active: true,
      prefix,
      createdAt: now,
      lastUsedAt: null,
    },
  }).catch(async () => {
    await setDoc(userRef, {
      quickExpenseToken: {
        active: true,
        prefix,
        createdAt: now,
        lastUsedAt: null,
      },
    }, { merge: true })
  })

  return {
    rawToken,
    prefix,
    createdAt: now,
  }
}

/**
 * Revokes active Quick Expense Token for a user.
 */
export async function revokeQuickExpenseToken(uid) {
  if (!uid) return

  // Find existing tokens for this uid
  const tokensRef = collection(db, 'quick_expense_tokens')
  const q = query(tokensRef, where('uid', '==', uid))
  const snapshot = await getDocs(q)

  const deletePromises = snapshot.docs.map((docSnap) => deleteDoc(doc(db, 'quick_expense_tokens', docSnap.id)))
  await Promise.all(deletePromises)

  // Update user document
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    'quickExpenseToken.active': false,
    'quickExpenseToken.revokedAt': new Date().toISOString(),
  }).catch(() => {})
}

/**
 * Verifies a raw token from an incoming API request.
 * Returns the uid if valid, or null if invalid/inactive.
 */
export async function verifyQuickToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return null
  const token = rawToken.trim()
  if (!token.startsWith('flw_sec_')) return null

  const tokenHash = await hashToken(token)
  if (!tokenHash) return null

  const tokenDocRef = doc(db, 'quick_expense_tokens', tokenHash)
  const tokenSnap = await getDoc(tokenDocRef)

  if (!tokenSnap.exists()) {
    return null
  }

  const data = tokenSnap.data()
  if (!data.active || !data.uid) {
    return null
  }

  // Update lastUsedAt in background
  updateDoc(tokenDocRef, {
    lastUsedAt: new Date().toISOString(),
  }).catch((err) => console.error('Error updating token lastUsedAt:', err))

  const userRef = doc(db, 'users', data.uid)
  updateDoc(userRef, {
    'quickExpenseToken.lastUsedAt': new Date().toISOString(),
  }).catch(() => {})

  return {
    uid: data.uid,
    tokenHash,
    prefix: data.prefix,
  }
}
