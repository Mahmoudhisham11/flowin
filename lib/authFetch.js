import { auth } from './auth'

/** fetch() that attaches the signed-in user's Firebase ID token. */
export async function authFetch(url, options = {}) {
  await auth.authStateReady()
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in')

  const token = await user.getIdToken()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
}
