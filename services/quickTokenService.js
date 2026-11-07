import { authFetch } from '@/lib/authFetch'

// Token creation/revocation/verification happen on the server (see app/api/quick-token and
// lib/quickTokenAdmin.js). The raw token is generated with a CSPRNG and only its hash is stored.

export async function createQuickExpenseToken() {
  const res = await authFetch('/api/quick-token', { method: 'POST' })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.rawToken) {
    throw new Error(json.error || 'Failed to generate token')
  }
  return { rawToken: json.rawToken, prefix: json.prefix, createdAt: json.createdAt }
}

export async function revokeQuickExpenseToken() {
  const res = await authFetch('/api/quick-token', { method: 'DELETE' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Failed to revoke token')
  }
}
