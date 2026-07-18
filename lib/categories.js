export const CATEGORIES = [
  { id: 'Food', labelEn: 'Food', labelAr: 'أكل', emoji: '🍔', color: '#F97316' },
  { id: 'Transport', labelEn: 'Transport', labelAr: 'مواصلات', emoji: '🚗', color: '#3B82F6' },
  { id: 'Shopping', labelEn: 'Shopping', labelAr: 'تسوق', emoji: '🛍️', color: '#8B5CF6' },
  { id: 'Bills', labelEn: 'Bills', labelAr: 'فواتير', emoji: '💰', color: '#EF4444' },
  { id: 'Smoking', labelEn: 'Smoking', labelAr: 'سجاير', emoji: '🚬', color: '#10B981' },
  { id: 'Entertainment', labelEn: 'Entertainment', labelAr: 'ترفيه', emoji: '🎮', color: '#F59E0B' },
  { id: 'Health', labelEn: 'Health', labelAr: 'صحة', emoji: '🏥', color: '#EC4899' },
  { id: 'Transfer', labelEn: 'Transfer', labelAr: 'تحويل', emoji: '🔄', color: '#4DA3FF' },
  { id: 'Other', labelEn: 'Other', labelAr: 'آخر', emoji: '📌', color: '#6B7280' },
]

export const categoryMap = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

export function getCategory(id) {
  return categoryMap[id] || categoryMap.Other
}

