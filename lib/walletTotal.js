// Sum of wallet balances, or undefined when the user has no wallet yet
// (then the Today amount follows the plan only).
export function walletsTotal(wallets) {
  if (!Array.isArray(wallets) || wallets.length === 0) return undefined
  return wallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0)
}
