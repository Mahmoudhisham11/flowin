const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0))

/**
 * Replaces {placeholders} in a translated string. Numbers are formatted with thousands
 * separators; strings (dates, labels, "2.5") are inserted as they are.
 */
export function fillText(text, params = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key]
    if (v === undefined || v === null) return ''
    return typeof v === 'number' ? fmt(v) : String(v)
  })
}
