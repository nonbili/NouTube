import i18n from 'i18next'
import type { Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'
import enText from '@/locales/en.json'
import deText from '@/locales/de.json'
import esText from '@/locales/es.json'
import frText from '@/locales/fr.json'
import idText from '@/locales/id.json'
import jaText from '@/locales/ja.json'
import ptText from '@/locales/pt.json'
import ptBRText from '@/locales/pt_BR.json'
import ruText from '@/locales/ru.json'
import trText from '@/locales/tr.json'
import viText from '@/locales/vi.json'
import zhHansText from '@/locales/zh_Hans.json'
import zhHantText from '@/locales/zh_Hant.json'
import type { Locale } from 'expo-localization'

export const supportedI18nLanguages = ['de', 'en', 'es', 'fr', 'id', 'ja', 'pt', 'pt_BR', 'ru', 'tr', 'vi', 'zh_Hans', 'zh_Hant'] as const
export type SupportedI18nLanguage = (typeof supportedI18nLanguages)[number]

export const i18nLanguageNativeNames: Record<SupportedI18nLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  ja: '日本語',
  pt: 'Português',
  pt_BR: 'Português (Brasil)',
  ru: 'Русский',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  zh_Hans: '简体中文',
  zh_Hant: '繁體中文',
}

const resources: Resource = {
  en: {
    translation: enText,
  },
  de: {
    translation: deText,
  },
  es: {
    translation: esText,
  },
  fr: {
    translation: frText,
  },
  id: {
    translation: idText,
  },
  ja: {
    translation: jaText,
  },
  pt: {
    translation: ptText,
  },
  pt_BR: {
    translation: ptBRText,
  },
  ru: {
    translation: ruText,
  },
  tr: {
    translation: trText,
  },
  vi: {
    translation: viText,
  },
  zh_Hans: {
    translation: zhHansText,
  },
  zh_Hant: {
    translation: zhHantText,
  },
}

const isSupportedLanguage = (value?: string | null): value is SupportedI18nLanguage =>
  Boolean(value && supportedI18nLanguages.includes(value as never))

export const resolveI18nLanguageFromExpoLocale = (locale?: Locale): SupportedI18nLanguage | undefined => {
  if (!locale?.languageCode) {
    return undefined
  }

  if (locale.languageCode === 'zh') {
    const isHant =
      locale.languageScriptCode === 'Hant' ||
      locale.languageTag?.toLowerCase().includes('hant') ||
      ['tw', 'hk', 'mo'].includes(locale.regionCode?.toLowerCase() || '')
    return isHant ? 'zh_Hant' : 'zh_Hans'
  }

  if (locale.languageCode === 'pt') {
    const isBR =
      locale.regionCode?.toLowerCase() === 'br' ||
      locale.languageTag?.toLowerCase().includes('br')
    return isBR ? 'pt_BR' : 'pt'
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
