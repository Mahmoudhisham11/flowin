// Ready-made choices shown during onboarding. `categoryId` links an essential to the
// transaction categories (lib/categories.js) so logged expenses count against it.

export const ESSENTIAL_PRESETS = [
  { id: 'rent', emoji: '🏠', labelEn: 'Rent / Housing', labelAr: 'إيجار / سكن' },
  { id: 'groceries', emoji: '🛒', labelEn: 'Groceries & home food', labelAr: 'أكل البيت', categoryId: 'Food' },
  { id: 'transport', emoji: '🚗', labelEn: 'Transport', labelAr: 'مواصلات', categoryId: 'Transport' },
  { id: 'bills', emoji: '💡', labelEn: 'Utilities & bills', labelAr: 'فواتير (كهرباء، مياه، غاز)', categoryId: 'Bills' },
  { id: 'phone', emoji: '📱', labelEn: 'Phone & internet', labelAr: 'موبايل وإنترنت', categoryId: 'Bills' },
  { id: 'installments', emoji: '💳', labelEn: 'Loans & installments', labelAr: 'أقساط وديون' },
  { id: 'education', emoji: '🎓', labelEn: 'Education', labelAr: 'تعليم' },
  { id: 'health', emoji: '🏥', labelEn: 'Health & medicine', labelAr: 'صحة وأدوية', categoryId: 'Health' },
  { id: 'family', emoji: '👨‍👩‍👧', labelEn: 'Family support', labelAr: 'مساعدة الأهل' },
]

// Habits that usually leak money. Used later to suggest category limits and reminders.
export const WEAK_SPOTS = [
  { id: 'food_out', emoji: '🍔', labelEn: 'Eating out & delivery', labelAr: 'أكل برة ودليفري', categoryId: 'Food' },
  { id: 'coffee', emoji: '☕', labelEn: 'Coffee & cafés', labelAr: 'قهوة وكافيهات', categoryId: 'Food' },
  { id: 'shopping', emoji: '🛍️', labelEn: 'Shopping & online orders', labelAr: 'تسوق وأونلاين', categoryId: 'Shopping' },
  { id: 'entertainment', emoji: '🎮', labelEn: 'Outings & entertainment', labelAr: 'خروجات وترفيه', categoryId: 'Entertainment' },
  { id: 'smoking', emoji: '🚬', labelEn: 'Smoking', labelAr: 'سجاير', categoryId: 'Smoking' },
  { id: 'rides', emoji: '🚕', labelEn: 'Taxi & ride-hailing', labelAr: 'أوبر وتاكسي', categoryId: 'Transport' },
]

export const SAVINGS_OPTIONS = [5, 10, 15, 20, 30]

export const DEFAULT_INCOME_SOURCE_NAME = { en: 'Salary', ar: 'المرتب' }
