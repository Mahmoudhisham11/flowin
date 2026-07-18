import { auth } from '@/lib/auth'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from 'firebase/auth'

export const signup = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password)
}

export const setDisplayName = async (user, name) => {
  return updateProfile(user, { displayName: name })
}

export const login = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password)
}

export const googleLogin = async () => {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export const logout = async () => {
  return signOut(auth)
}

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback)
}

export const changePassword = async (currentPassword, newPassword) => {
  const user = auth.currentUser
  if (!user || !user.email) throw new Error('No authenticated user')

  const credential = EmailAuthProvider.credential(user.email, currentPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}

