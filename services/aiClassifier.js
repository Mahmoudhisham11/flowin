import { CATEGORIES } from '@/lib/categories'

const VALID_EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.id !== 'Transfer')
const VALID_CATEGORY_IDS = VALID_EXPENSE_CATEGORIES.map((c) => c.id)

// Fast rule-based keyword matcher for Egyptian Arabic & English terms
const KEYWORD_RULES = [
  {
    category: 'Food',
    keywords: [
      'أكل', 'اكل', 'غداء', 'غدا', 'فطار', 'عشاء', 'عشا', 'وجبة', 'مطعم', 'ساندوتش', 'سندوتش', 'بيتزا', 'برجر',
      'كريب', 'كشري', 'فول', 'طعمية', 'شاورما', 'كافيه', 'قهوة', 'شاي', 'نسكافيه', 'سوبرماركت', 'ماركت', 'طلبات',
      'بقالة', 'خضار', 'فاكهة', 'لحمة', 'فراخ', 'سمك', 'جبنة', 'لبن', 'خبز', 'عيش', 'حلويات', 'عصير', 'ماك', 'كنتاكي',
      'food', 'lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'restaurant', 'groceries', 'burger', 'pizza', 'supermarket'
    ]
  },
  {
    category: 'Transport',
    keywords: [
      'مواصلات', 'بنزين', 'سولار', 'اوبر', 'أوبر', 'كريم', 'اندرايف', 'إن درايف', 'تاكسي', 'مترو', 'ميكروباص',
      'اتوبيس', 'أتوبيس', 'قطر', 'تذكرة قطر', 'تذكرة مترو', 'تذكرة اتوبيس', 'تذكرة باص', 'كارته', 'كارتة', 'ركنة', 'جراج', 'سايس', 'صيانة عربية', 'ميكانيكي',
      'كاوتش', 'غسيل عربية', 'زيت عربية', 'باص',
      'uber', 'careem', 'transport', 'petrol', 'gas', 'taxi', 'metro', 'bus', 'parking', 'car'
    ]
  },
  {
    category: 'Shopping',
    keywords: [
      'تسوق', 'شوبينج', 'هدوم', 'ملابس', 'تيشيرت', 'بنطلون', 'قميص', 'شوز', 'جزمة', 'كوتشي', 'فستان',
      'امازون', 'أمازون', 'نون', 'زارا', 'ساعة', 'اكسسوارات', 'شنطة', 'مكياج', 'ميكب', 'برفان', 'عطور',
      'shopping', 'clothes', 'shoes', 'amazon', 'noon', 'shirt', 'pants', 'dress'
    ]
  },
  {
    category: 'Bills',
    keywords: [
      'فواتير', 'فاتورة', 'كهرباء', 'مياه', 'ميه', 'غاز', 'نت', 'انترنت', 'إنترنت', 'واي فاي', 'وي', 'فودافون',
      'اورنج', 'أورانج', 'اتصالات', 'we', 'vodafone', 'orange', 'etisalat', 'رصيد', 'شحن', 'كارت شحن', 'اشتراك',
      'ايجار', 'إيجار', 'مصاريف جامعة', 'مصاريف مدرسة', 'مصاريف دراسية', 'دروس', 'سنتر', 'صيانة', 'اقساط', 'قسط',
      'bill', 'bills', 'electricity', 'water', 'gas', 'internet', 'wifi', 'recharge', 'rent', 'tuition', 'subscription'
    ]
  },
  {
    category: 'Smoking',
    keywords: [
      'سجاير', 'سجائر', 'دخان', 'فيب', 'شيشة', 'معسل', 'مارلبورو', 'ميريت', 'ال ام', 'lm', 'وينستون', 'كابتن بلاك', 'توباكو',
      'smoking', 'cigarettes', 'vape', 'tobacco'
    ]
  },
  {
    category: 'Entertainment',
    keywords: [
      'ترفيه', 'خروج', 'فسحة', 'سينما', 'فيلم', 'بلايستيشن', 'العاب', 'ألعاب', 'رحلة', 'مصيف', 'سفر', 'بولينج',
      'حفلة', 'نادي', 'ماتش', 'حجز كورة', 'تسلية',
      'entertainment', 'cinema', 'movie', 'games', 'playstation', 'trip', 'outing', 'fun'
    ]
  },
  {
    category: 'Health',
    keywords: [
      'صحة', 'دكتور', 'طبيب', 'علاج', 'ادوية', 'أدوية', 'دواء', 'صيدلية', 'روشتة', 'مستشفى', 'عيادة', 'تحاليل',
      'معمل', 'اشعة', 'أشعة', 'اسنان', 'أسنان', 'كشف', 'فيزيتا',
      'health', 'doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'dentist', 'lab'
    ]
  }
]

/**
 * Fast keyword-based classifier for immediate, offline, and reliable classification.
 */
export function classifyByKeywords(text) {
  if (!text) return 'Other'
  const lower = text.toLowerCase()

  // Build flattened list sorted by length descending to match specific keywords first
  const allKeywords = []
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      allKeywords.push({ keyword: kw.toLowerCase(), category: rule.category })
    }
  }
  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length)

  for (const item of allKeywords) {
    if (lower.includes(item.keyword)) {
      return item.category
    }
  }
  return 'Other'
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a financial category classifier specialized in Egyptian Arabic (اللهجة المصرية) and English.
Given an expense reason/description, classify it into EXACTLY ONE of the following category IDs:
- Food (أكل، شرب، مطاعم، بقالة، كافيهات)
- Transport (مواصلات، بنزين، أوبر، تاكسي، صيانة سيارة)
- Shopping (تسوق، ملابس، أحذية، مشتريات شخصية)
- Bills (فواتير، كهرباء، مياه، غاز، انترنت، شحن رصيد، اشتراكات، إيجار)
- Smoking (سجاير، فيب، دخان، معسل)
- Entertainment (ترفيه، سينما، ألعاب، خروجات، مصايف)
- Health (صحة، أدوية، دكتور، صيدلية، مستشفى، تحاليل)
- Other (أي شيء غير ذلك)

Output format: Return ONLY the exact category ID (e.g. Food or Transport). No JSON, no explanations, no markdown.`

const FREE_MODELS = [
  'minimax/minimax-m3:free',
  'openrouter/free',
]

/**
 * Classifies an expense description using OpenRouter AI with fallback to keyword matching.
 * Guarantees a valid category ID from CATEGORIES.
 */
export async function classifyExpenseCategory(reason) {
  const text = String(reason || '').trim()
  if (!text) return 'Other'

  const apiKey = process.env.OPENROUTER_API_KEY
  if (apiKey) {
    for (const model of FREE_MODELS) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
              { role: 'user', content: text },
            ],
            temperature: 0.1,
            max_tokens: 20,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const rawCategory = data.choices?.[0]?.message?.content?.trim() || ''
          
          // Normalize and validate category
          const cleanCat = rawCategory.replace(/[^a-zA-Z]/g, '')
          const matched = VALID_CATEGORY_IDS.find(
            (id) => id.toLowerCase() === cleanCat.toLowerCase()
          )
          if (matched) {
            return matched
          }
        }
      } catch (err) {
        console.warn(`AI classification attempt failed with model ${model}:`, err.message)
      }
    }
  }

  // Fallback to fast and accurate keyword analysis
  return classifyByKeywords(text)
}
