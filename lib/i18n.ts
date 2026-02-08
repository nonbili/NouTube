import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enText from '@/locales/en.json'
import frText from '@/locales/fr.json'
import idText from '@/locales/id.json'
import ruText from '@/locales/ru.json'
import zhHansText from '@/locales/zh_Hans.json'

const resources = {
  en: {
    translation: enText,
  },
  fr: {
    translation: frText,
  },
  id: {
    translation: idText,
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

i18n.use(initReactI18next).init({
  /* debug: true, */
  fallbackLng: 'en',
  supportedLngs: Object.keys(resources),
  resources,
})
