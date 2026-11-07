import { authFetch } from '@/lib/authFetch'

async function parse(res, fallback) {
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || fallback)
  return json
}

export async function submitUpgradeRequest({ phone, refId, amount }) {
  await parse(
    await authFetch('/api/subscription/upgrade-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, refId, amount }),
    }),
    'Failed to submit upgrade request'
  )
}

// Admin only (enforced on the server).
export async function getPendingUpgrades() {
  const json = await parse(await authFetch('/api/admin/upgrades'), 'Failed to load upgrade requests')
  return json.upgrades
}

async function decide(id, action) {
  await parse(
    await authFetch('/api/admin/upgrades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    }),
    'Failed to process upgrade request'
  )
}

export const approveUpgrade = (docId) => decide(docId, 'approve')
export const rejectUpgrade = (docId) => decide(docId, 'reject')
