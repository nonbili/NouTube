import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import enText from '@/locales/en.json'

i18n.use(initReactI18next).init({
  /* debug: true, */
  fallbackLng: 'en',
  supportedLngs: ['en'],
  resources: {
    en: {
      translation: enText,
    },
    /* ja: {
     *   translation: jaText,
     * }, */
  },
})
