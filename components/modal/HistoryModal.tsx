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
import { HistoryItem } from '../history/HistoryItem'
import { history$ } from '@/states/history'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'
import { getPageType } from '@/lib/page'
import { NouButton } from '../button/NouButton'
import { t } from 'i18next'

export const HistoryModal = () => {
  const historyModalOpen = use$(ui$.historyModalOpen)
  const bookmarks = use$(history$.bookmarks)
  const home = use$(settings$.home)

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((x) => {
      const pageType = getPageType(x.url)
      return pageType?.home == home
    })
  }, [bookmarks, bookmarks.length, home])

  return nIf(
    historyModalOpen,
    <BaseModal onClose={() => ui$.historyModalOpen.set(false)}>
      <View className="mt-3 mb-4 px-2 flex-row items-center justify-between">
        <View className="flex-row items-baseline">
          <NouText className="font-semibold text-lg">{t('modals.history')}</NouText>
          <NouText className="text-sm text-gray-400 pl-4"></NouText>
        </View>
        {nIf(
          filteredBookmarks.length,
          <NouButton
            variant="outline"
            size="1"
            onPress={() => {
              history$.bookmarks.set([])
              ui$.historyModalOpen.set(false)
            }}
          >
            Clear
          </NouButton>,
        )}
      </View>
      <FlatList
        data={filteredBookmarks}
        keyExtractor={(item) => item.url}
        renderItem={({ item, index }) => <HistoryItem bookmark={item} />}
      />
    </BaseModal>,
  )
}
