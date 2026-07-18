'use client'

import { useLocale } from '@/contexts/LocaleContext'
import { translations } from '@/lib/translations'

export function useTranslation() {
  const { lang } = useLocale()

  const t = (key) => {
    const keys = key.split('.')
    let val = translations[lang]
    for (const k of keys) {
      if (val && typeof val === 'object') val = val[k]
      else {
        val = translations.en
        for (const kk of keys) {
          val = val ? val[kk] : key
        }
        break
      }
    }
    return typeof val === 'string' ? val : key
  }

  return { t, lang, isAr: lang === 'ar' }
}
