import { normalizeArabic } from './budgetMatch.js'

// Instant, offline guesses from what the user types (Egyptian Arabic + English).
// Matching is word-based so short words never fire inside other words ("نت" vs "نتيجة", "bus" vs "business").

const CATEGORY_WORDS = [
  ['Smoking', ['سجاير', 'سجايري', 'سيجاره', 'شيشه', 'دخان', 'cigarette', 'cigarettes', 'smoke', 'vape', 'shisha']],
  ['Transport', ['اوبر', 'uber', 'كريم', 'careem', 'تاكسي', 'taxi', 'بنزين', 'سولار', 'مواصلات', 'ميكروباص', 'مترو', 'اتوبيس', 'جراج', 'fuel', 'petrol', 'metro', 'bus', 'parking']],
  ['Bills', ['فاتوره', 'فواتير', 'كهربا', 'كهرباء', 'غاز', 'ميه', 'مياه', 'نت', 'انترنت', 'رصيد', 'شحن', 'باقه', 'اشتراك', 'bill', 'bills', 'electricity', 'water', 'internet', 'wifi', 'subscription', 'recharge']],
  ['Health', ['دوا', 'دواء', 'ادويه', 'صيدليه', 'دكتور', 'كشف', 'مستشفي', 'تحاليل', 'تحليل', 'اشعه', 'عياده', 'pharmacy', 'doctor', 'medicine', 'hospital', 'clinic']],
  ['Entertainment', ['سينما', 'فيلم', 'نتفليكس', 'netflix', 'spotify', 'لعبه', 'العاب', 'بلايستيشن', 'ps5', 'خروجه', 'رحله', 'حفله', 'مسرح', 'cinema', 'movie', 'game', 'gaming', 'concert', 'trip']],
  ['Shopping', ['هدوم', 'ملابس', 'جزمه', 'حذاء', 'شنطه', 'امازون', 'amazon', 'نون', 'noon', 'جوميا', 'jumia', 'تسوق', 'مول', 'هديه', 'shopping', 'clothes', 'shoes', 'gift', 'mall']],
  ['Food', ['اكل', 'اكله', 'غدا', 'عشا', 'فطار', 'سحور', 'مطعم', 'دليفري', 'طلبات', 'talabat', 'بيتزا', 'برجر', 'شاورما', 'كشري', 'فول', 'طعميه', 'سوبرماركت', 'بقاله', 'خضار', 'فاكهه', 'قهوه', 'كافيه', 'كوفي', 'شاي', 'عصير', 'حلويات', 'food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'pizza', 'burger', 'coffee', 'cafe', 'grocery', 'groceries', 'delivery', 'snack']],
]

// Fixed expenses (presetId from lib/planPresets.js) the user may be paying.
const ESSENTIAL_WORDS = {
  rent: ['ايجار', 'rent'],
  installments: ['قسط', 'اقساط', 'installment', 'installments', 'loan'],
  education: ['مدرسه', 'جامعه', 'دروس', 'كورس', 'tuition', 'school'],
  health: ['علاج', 'ادويه'],
  family: ['الاهل', 'ماما', 'بابا', 'family'],
}

const prep = (list) => list.map((w) => normalizeArabic(w)).filter(Boolean)
const CATEGORIES_PREPARED = CATEGORY_WORDS.map(([id, words]) => [id, prep(words)])
const ESSENTIALS_PREPARED = Object.entries(ESSENTIAL_WORDS).map(([id, words]) => [id, prep(words)])

const PREFIX = /^(وال|بال|فال|كال|لل|ال|و|ب|ل|ف)/

function tokenize(texts) {
  return normalizeArabic(texts.filter(Boolean).join(' '))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function tokenMatches(token, word) {
  if (token === word) return true
  // Allow suffixes for longer words (سجايري, restaurants) but never for short ones.
  if (word.length >= 4 && token.startsWith(word)) return true
  const stripped = token.replace(PREFIX, '')
  if (stripped.length >= 2 && stripped !== token) {
    return stripped === word || (word.length >= 4 && stripped.startsWith(word))
  }
  return false
}

function anyMatch(tokens, words) {
  return words.some((w) => tokens.some((tk) => tokenMatches(tk, w)))
}

/** Category id from lib/categories.js, or null when nothing matches. */
export function guessCategory(...texts) {
  const tokens = tokenize(texts)
  if (tokens.length === 0) return null
  for (const [id, words] of CATEGORIES_PREPARED) {
    if (anyMatch(tokens, words)) return id
  }
  return null
}

/** presetId of a fixed expense (e.g. "rent") that exists in `essentials`, or null. */
export function guessEssentialKey(essentials, ...texts) {
  const tokens = tokenize(texts)
  if (tokens.length === 0 || !Array.isArray(essentials)) return null
  for (const [presetId, words] of ESSENTIALS_PREPARED) {
    if (anyMatch(tokens, words) && essentials.some((e) => e.presetId === presetId)) return presetId
  }
  return null
}
