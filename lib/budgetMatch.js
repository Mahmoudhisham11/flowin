import { CATEGORIES } from './categories'

export const normalizeArabic = (s) =>
  String(s).trim()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/[ى]/g, 'ي')
    .replace(/[ة]/g, 'ه')
    .toLowerCase()

export function findMatchingCategory(categories, categoryName) {
  const nameLower = normalizeArabic(categoryName)

  let match = categories.find(
    (c) => normalizeArabic(c.name) === nameLower
  )
  if (match) return match

  match = categories.find(
    (c) => c.categoryId && normalizeArabic(c.categoryId) === nameLower
  )
  if (match) return match

  const catInfo = CATEGORIES.find(
    (c) => normalizeArabic(c.id) === nameLower || c.id.toLowerCase() === nameLower
  )
  if (catInfo) {
    match = categories.find(
      (c) =>
        normalizeArabic(c.name) === normalizeArabic(catInfo.labelAr) ||
        normalizeArabic(c.name) === normalizeArabic(catInfo.labelEn) ||
        c.name.trim().toLowerCase() === catInfo.labelEn.toLowerCase()
    )
    if (match) return match
  }

  return null
}
