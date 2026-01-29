import { auth$ } from '@/states/auth'
import { MainPageContent } from './MainPageContent'
import { supabase } from '@/lib/supabase/client'
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query/client'
import { useMe } from '@/lib/hooks/useMe'
import { BookmarkModal } from '../modal/BookmarkModal'
import { FolderModal } from '../modal/FolderModal'
import { HistoryModal } from '../modal/HistoryModal'
import { LibraryModal } from '../modal/LibraryModal'
import { QueueModal } from '../modal/QueueModal'
import { SettingsModal } from '../modal/SettingsModal'
import { feederLoop } from '@/lib/feeder'
import { FeedModal } from '../modal/FeedModal'
import { UrlModal } from '../modal/UrlModal'
import { Locale, useLocales } from 'expo-localization'
import i18n from 'i18next'

function expoLocaleToI18nLocale(locale: Locale): string | undefined {
  const { languageCode, languageScriptCode } = locale
  if (languageCode == 'zh') {
    return `${languageCode}_${languageScriptCode}`
  }
  return languageCode || undefined
}

export const MainPage: React.FC<{ contentJs: string }> = ({ contentJs }) => {
  const locales = useLocales()

  useEffect(() => {
    i18n.changeLanguage(expoLocaleToI18nLocale(locales[0]))
  }, [locales[0]])

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      // console.log('onAuthStateChange', event, session)
      auth$.assign({
        loaded: true,
        userId: session?.user.id,
        user: session?.user.user_metadata,
        accessToken: session?.access_token,
      })
    })

    feederLoop()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <MainPageContent contentJs={contentJs} />
      <LibraryModal />
      <BookmarkModal />
      <FeedModal />
      <FolderModal />
      <HistoryModal />
      <QueueModal />
      <SettingsModal />
      <UrlModal />
    </QueryClientProvider>
  )
}
