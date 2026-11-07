'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '@/lib/firestore'
import { doc, getDoc } from 'firebase/firestore'
import { authFetch } from '@/lib/authFetch'
import { useAuth } from '@/hooks/useAuth'
import {
  signup as firebaseSignup,
  login as firebaseLogin,
  googleLogin as firebaseGoogleLogin,
  logout as firebaseLogout,
  setDisplayName,
} from '@/services/firebaseAuth'

const UserContext = createContext(null)

function getErrorMessage(error) {
  const code = error?.code || ''
  const map = {
    'auth/email-already-in-use': 'This email is already registered',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/invalid-email': 'Invalid email address',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
  }
  return map[code] || error.message || 'Something went wrong'
}

export function UserProvider({ children }) {
  const { user: firebaseUser, loading: authLoading } = useAuth()
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userLoading, setUserLoading] = useState(false)

  useEffect(() => {
    if (authLoading) return

    setLoading(false)

    if (!firebaseUser) {
      setUserData(null)
      setUserLoading(false)
      return
    }

    let cancelled = false

    const fetchUserData = async () => {
      setUserLoading(true)
      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(userRef)

        if (cancelled) return

        if (snap.exists()) {
          setUserData({ id: firebaseUser.uid, ...snap.data() })
        } else {
          // First sign-in: the server creates the profile and decides role/trial dates.
          const res = await authFetch('/api/account/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: firebaseUser.displayName || '' }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok || !json.user) {
            throw new Error(json.error || 'Failed to create account profile')
          }
          if (!cancelled) {
            setUserData({ id: firebaseUser.uid, ...json.user })
          }
        }
      } catch (err) {
        console.error('[UserContext] Failed to load user profile:', err)
      } finally {
        if (!cancelled) setUserLoading(false)
      }
    }

    fetchUserData()

    return () => { cancelled = true }
  }, [firebaseUser, authLoading])

  const signup = async (name, email, password) => {
    const cred = await firebaseSignup(email, password)
    if (name) {
      await setDisplayName(cred.user, name)
    }
  }

  const login = async (email, password) => {
    await firebaseLogin(email, password)
  }

  const googleLogin = async () => {
    await firebaseGoogleLogin()
  }

  const logout = async () => {
    await firebaseLogout()
    setUserData(null)
  }

  const value = {
    user: firebaseUser,
    userData,
    loading,
    userLoading,
    signup,
    login,
    googleLogin,
    logout,
    getErrorMessage,
  }

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be inside UserProvider')
  return ctx
}
