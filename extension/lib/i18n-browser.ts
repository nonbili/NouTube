import i18n from 'i18next'
import { normalizeI18nLanguage, type SupportedI18nLanguage } from '@/lib/i18n'

/* The app resolves the language from an expo Locale; here the browser's own
 * accept-language list plays that part. */
export function resolveBrowserLanguage(): SupportedI18nLanguage {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const lower = (tag || '').toLowerCase()
    if (lower.startsWith('zh')) {
      return /hant|tw|hk|mo/.test(lower) ? 'zh_Hant' : 'zh_Hans'
    }
    if (lower.startsWith('pt')) {
      return lower.includes('br') ? 'pt_BR' : 'pt'
    }
    const match = normalizeI18nLanguage(lower.split('-')[0])
    if (match) {
      return match
    }
  }
  return 'en'
}

export function applyLanguage(language: string | null) {
  const next = normalizeI18nLanguage(language) || resolveBrowserLanguage()
  if (i18n.language !== next) {
    void i18n.changeLanguage(next)
  }
}
