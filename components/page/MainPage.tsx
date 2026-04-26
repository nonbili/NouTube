import { auth$ } from '@/states/auth'
import { MainPageContent } from './MainPageContent'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query/client'
import { BookmarkModal } from '../modal/BookmarkModal'
import { FolderModal } from '../modal/FolderModal'
import { HistoryModal } from '../modal/HistoryModal'
import { LibraryModal } from '../modal/LibraryModal'
import { QueueModal } from '../modal/QueueModal'
import { SettingsModal } from '../modal/SettingsModal'
import { feederLoop } from '@/lib/feeder'
import { FeedModal } from '../modal/FeedModal'
import { UrlModal } from '../modal/UrlModal'
import { CookieModal } from '../modal/CookieModal'
import { UserAgentModal } from '../modal/UserAgentModal'
import { SleepTimerModal } from '../modal/SleepTimerModal'
import { PlaybackSpeedModal } from '../modal/PlaybackSpeedModal'
import { ToolsModal } from '../modal/ToolsModal'
import { useLocales } from 'expo-localization'
import { changeLanguage, t as i18nextT } from 'i18next'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { isWeb } from '@/lib/utils'
import { resolveI18nLanguageFromExpoLocale } from '@/lib/i18n'
import { settings$ } from '@/states/settings'

export const MainPage: React.FC<{ contentJs: string }> = ({ contentJs }) => {
  const locales = useLocales()
  const primaryLocale = locales[0]
  const selectedLanguage = useValue(settings$.language)
  const systemLanguage = resolveI18nLanguageFromExpoLocale(primaryLocale) || 'en'
  const [, setLanguageRevision] = useState(0)

  useEffect(() => {
    let active = true

    const apply = async () => {
      await changeLanguage(selectedLanguage || systemLanguage)
      if (!active) {
        return
      }
      if (!isWeb) {
        const strings = i18nextT('native', { returnObjects: true }) as Record<string, string>
        NouTubeViewModule.setLocaleStrings(strings)
      }
      setLanguageRevision((revision) => revision + 1)
    }
    void apply()

    return () => {
      active = false
    }
  }, [
    primaryLocale?.languageCode,
    primaryLocale?.languageScriptCode,
    primaryLocale?.regionCode,
    selectedLanguage,
    systemLanguage,
  ])

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
      <FeedModal />
      <BookmarkModal />
      <FolderModal />
      <HistoryModal />
      <QueueModal />
      <SettingsModal />
      <UrlModal />
      <CookieModal />
      <UserAgentModal />
      <SleepTimerModal />
      <PlaybackSpeedModal />
      <ToolsModal />
    </QueryClientProvider>
  )
}
