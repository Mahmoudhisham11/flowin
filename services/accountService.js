import { authFetch } from '@/lib/authFetch'

/** Downloads the user's data as a JSON file. */
export async function exportMyData() {
  const res = await authFetch('/api/account/export')
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error || 'Export failed')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flowin-data-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Permanently deletes the account. Throws an error with `code === 'REAUTH'` if a fresh sign-in is needed. */
export async function deleteMyAccount() {
  const res = await authFetch('/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'DELETE' }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || 'Could not delete the account')
    err.code = json.code
    throw err
  }
}
