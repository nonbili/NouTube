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

export const MainPage: React.FC<{ contentJs: string }> = ({ contentJs }) => {
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
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <MainPageContent contentJs={contentJs} />
      <LibraryModal />
      <BookmarkModal />
      <FolderModal />
      <HistoryModal />
      <QueueModal />
      <SettingsModal />
    </QueryClientProvider>
  )
}
