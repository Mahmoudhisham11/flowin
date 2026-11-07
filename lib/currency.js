// Supported currencies. `ar` is the short label used in Arabic notification text.
export const CURRENCIES = [
  { code: 'EGP', nameEn: 'Egyptian Pound', nameAr: 'جنيه مصري', ar: 'ج.م' },
  { code: 'SAR', nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي', ar: 'ر.س' },
  { code: 'AED', nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي', ar: 'د.إ' },
  { code: 'KWD', nameEn: 'Kuwaiti Dinar', nameAr: 'دينار كويتي', ar: 'د.ك' },
  { code: 'QAR', nameEn: 'Qatari Riyal', nameAr: 'ريال قطري', ar: 'ر.ق' },
  { code: 'BHD', nameEn: 'Bahraini Dinar', nameAr: 'دينار بحريني', ar: 'د.ب' },
  { code: 'OMR', nameEn: 'Omani Rial', nameAr: 'ريال عماني', ar: 'ر.ع' },
  { code: 'JOD', nameEn: 'Jordanian Dinar', nameAr: 'دينار أردني', ar: 'د.أ' },
  { code: 'MAD', nameEn: 'Moroccan Dirham', nameAr: 'درهم مغربي', ar: 'د.م' },
  { code: 'TND', nameEn: 'Tunisian Dinar', nameAr: 'دينار تونسي', ar: 'د.ت' },
  { code: 'TRY', nameEn: 'Turkish Lira', nameAr: 'ليرة تركية', ar: 'ل.ت' },
  { code: 'USD', nameEn: 'US Dollar', nameAr: 'دولار أمريكي', ar: '$' },
  { code: 'EUR', nameEn: 'Euro', nameAr: 'يورو', ar: '€' },
  { code: 'GBP', nameEn: 'British Pound', nameAr: 'جنيه إسترليني', ar: '£' },
]

export const DEFAULT_CURRENCY = 'EGP'

const CODES = new Set(CURRENCIES.map((c) => c.code))

export function isValidCurrency(code) {
  return typeof code === 'string' && CODES.has(code)
}

/** Returns a supported currency code, falling back to the default. */
export function normalizeCurrency(code) {
  return isValidCurrency(code) ? code : DEFAULT_CURRENCY
}

/** Short Arabic label (e.g. ج.م), used in server-built Arabic text such as push notifications. */
export function currencyLabelAr(code) {
  return CURRENCIES.find((c) => c.code === normalizeCurrency(code))?.ar || code
}
