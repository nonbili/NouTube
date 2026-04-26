import i18n from 'i18next'
import type { Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import enText from '@/locales/en.json'
import deText from '@/locales/de.json'
import frText from '@/locales/fr.json'
import idText from '@/locales/id.json'
import ptBRText from '@/locales/pt_BR.json'
import ruText from '@/locales/ru.json'
import zhHansText from '@/locales/zh_Hans.json'
import type { Locale } from 'expo-localization'

export const supportedI18nLanguages = ['de', 'en', 'fr', 'id', 'pt_BR', 'ru', 'zh_Hans'] as const
export type SupportedI18nLanguage = (typeof supportedI18nLanguages)[number]

export const i18nLanguageNativeNames: Record<SupportedI18nLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  pt_BR: 'Português (Brasil)',
  ru: 'Русский',
  zh_Hans: '简体中文',
}

const resources: Resource = {
  en: {
    translation: enText,
  },
  de: {
    translation: deText,
  },
  fr: {
    translation: frText,
  },
  id: {
    translation: idText,
  },
  pt_BR: {
    translation: ptBRText,
  },
  /* ja: {
   *   translation: jaText,
   * }, */
  ru: {
    translation: ruText,
  },
  zh_Hans: {
    translation: zhHansText,
  },
}

const isSupportedLanguage = (value?: string | null): value is SupportedI18nLanguage =>
  Boolean(value && supportedI18nLanguages.includes(value as never))

export const resolveI18nLanguageFromExpoLocale = (locale?: Locale): SupportedI18nLanguage | undefined => {
  if (!locale?.languageCode) {
    return undefined
  }

  if (locale.languageCode === 'zh') {
    return 'zh_Hans'
  }

  if (locale.languageCode === 'pt') {
    return 'pt_BR'
  }

  return isSupportedLanguage(locale.languageCode) ? locale.languageCode : undefined
}

export const normalizeI18nLanguage = (value?: string | null): SupportedI18nLanguage | null =>
  value == null ? null : isSupportedLanguage(value) ? value : null

// eslint-disable-next-line import/no-named-as-default-member
i18n.use(initReactI18next).init({
  /* debug: true, */
  fallbackLng: 'en',
  supportedLngs: Object.keys(resources),
  resources,
})
