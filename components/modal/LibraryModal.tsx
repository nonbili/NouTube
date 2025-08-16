import { use$ } from '@legendapp/state/react'
import { BaseModal } from './BaseModal'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { bookmarks$ } from '@/states/bookmarks'
import { useMemo, useState } from 'react'
import { getPageType } from '@/lib/page'
import { settings$ } from '@/states/settings'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { Segemented } from '../picker/Segmented'
import { FlatList, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { clsx, isWeb } from '@/lib/utils'

const tabsYT = ['Bookmarks', 'Channels', 'Playlist']
const tabsYTMusic = ['Songs', 'Artists', 'Playlist']

export const LibraryModal = () => {
  const libraryModalOpen = use$(ui$.libraryModalOpen)
  const bookmarks = use$(bookmarks$.bookmarks)
  const updatedAt = use$(bookmarks$.updatedAt)
  const home = use$(settings$.home)
  const [tabIndex, setTabIndex] = useState(0)
  const isYTMusic = use$(settings$.isYTMusic)
  const tabs = isYTMusic ? tabsYTMusic : tabsYT
  const insets = useSafeAreaInsets()

  const filteredBookmarks = useMemo(() => {
    const types = [['podcast', 'shorts', 'watch'], ['channel'], ['playlist']][tabIndex]
    return bookmarks.filter((x) => {
      if (x.json.deleted) {
        return false
      }
      const pageType = getPageType(x.url)
      return pageType?.home == home && types.includes(pageType?.type)
    })
  }, [bookmarks, updatedAt, tabIndex, home])

  return (
    <BaseModal className={libraryModalOpen ? 'block' : 'hidden'} onClose={() => ui$.libraryModalOpen.set(false)}>
      <View className={clsx('items-center mb-4', isWeb && 'mt-4')}>
        <Segemented options={tabs} selectedIndex={tabIndex} onChange={setTabIndex} />
      </View>
      <FlatList
        data={filteredBookmarks}
        keyExtractor={(item) => item.url}
        renderItem={({ item }) => <BookmarkItem bookmark={item} />}
        ListFooterComponent={<View className="mb-1" style={{ paddingBottom: insets.bottom }} />}
      />
    </BaseModal>
  )
}
