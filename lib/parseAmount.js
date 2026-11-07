// Parses what a user types into an amount field. Accepts Arabic-Indic digits and
// Arabic decimal/thousand separators; returns a non-negative number (0 when invalid).
export function toNum(value) {
  const normalized = String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
    .replace(/[^\d.]/g, '')
  const n = parseFloat(normalized)
  return Number.isFinite(n) && n > 0 ? n : 0
}
