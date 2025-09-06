import { Pressable, View, TouchableOpacity, ActivityIndicator, ScrollView, FlatList } from 'react-native'
import { NouText } from '../NouText'
import { version } from '../../package.json'
import { useMemo, useState } from 'react'
import { colors } from '@/lib/colors'
import { clsx, nIf } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv } from '@/lib/import'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { FeedItem } from '../feed/FeedItem'
import { feeds$ } from '@/states/feeds'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'
import { getPageType } from '@/lib/page'
import { NouButton } from '../button/NouButton'

export const FeedModal = () => {
  const feedModalOpen = use$(ui$.feedModalOpen)
  const bookmarks = use$(feeds$.bookmarks)
  const home = use$(settings$.home)

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return pageType?.home == home
    })
  }, [bookmarks, bookmarks.length, home])

  return nIf(
    feedModalOpen,
    <BaseModal onClose={() => ui$.feedModalOpen.set(false)}>
      <View className="mt-3 mb-4 px-2 flex-row items-center justify-between">
        <View className="flex-row items-baseline">
          <NouText className="font-semibold text-lg">Feeds</NouText>
        </View>
      </View>
      <FlatList
        data={filteredBookmarks}
        keyExtractor={(item) => item.url}
        renderItem={({ item, index }) => <FeedItem bookmark={item} />}
      />
    </BaseModal>,
  )
}
