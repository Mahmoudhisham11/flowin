'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { db } from '@/lib/firestore'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
          const newUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            provider: firebaseUser.providerData[0]?.providerId || 'email',
            createdAt: new Date().toISOString(),
            signUpMethod: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email',
            role: 'free',
            trialStart: new Date().toISOString(),
            subEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }
          await setDoc(userRef, newUser)
          if (!cancelled) {
            setUserData({ id: firebaseUser.uid, ...newUser })
          }
        }
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
