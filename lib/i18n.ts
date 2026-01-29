import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import enText from '@/locales/en.json'
import ruText from '@/locales/ru.json'
import zhHansText from '@/locales/zh_Hans.json'

i18n.use(initReactI18next).init({
  /* debug: true, */
  fallbackLng: 'en',
  supportedLngs: ['en', 'ru', 'zh_Hans'],
  resources: {
    en: {
      translation: enText,
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
  },
})
