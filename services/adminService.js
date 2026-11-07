import { authFetch } from '@/lib/authFetch'

// Admin operations run on the server (verified admin role); the browser never writes roles.

async function parse(res, fallback) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || fallback)
  return json
}

export async function getAllUsers() {
  const json = await parse(await authFetch('/api/admin/users'), 'Failed to load users')
  return json.users
}

export async function updateUserRole(uid, newRole) {
  await parse(
    await authFetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, role: newRole }),
    }),
    'Failed to update role'
  )
}
