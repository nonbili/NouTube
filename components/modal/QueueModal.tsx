import {
  Modal,
  Text,
  Pressable,
  View,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native'
import { NouText } from '../NouText'
import { version } from '../../package.json'
import { useState } from 'react'
import { colors } from '@/lib/colors'
import { clsx } from '@/lib/utils'
import { use$ } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { Segemented } from '../picker/Segmented'
import { getDocumentAsync } from 'expo-document-picker'
import { importCsv } from '@/lib/import'
import { BookmarkItem } from '../bookmark/BookmarkItem'
import { QueueItem } from '../queue/QueueItem'
import { queue$ } from '@/states/queue'
import { usePlayingQueueIndex } from '@/lib/queue'
import { ui$ } from '@/states/ui'
import { BaseModal } from './BaseModal'

export const QueueModal = () => {
  const queueModalOpen = use$(ui$.queueModalOpen)
  const { playingIndex, size } = usePlayingQueueIndex()
  const queue = use$(queue$.bookmarks)

  return (
    queueModalOpen && (
      <BaseModal onClose={() => ui$.queueModalOpen.set(false)}>
        <View className="mt-3 mb-4 px-4 flex-row items-center justify-between">
          <View className="flex-row items-baseline">
            <NouText className="font-medium text-lg">Queue</NouText>
            <NouText className="text-sm text-gray-400 pl-4">
              {playingIndex + 1} / {size}
            </NouText>
          </View>
          <TouchableOpacity
            onPress={() => {
              queue$.bookmarks.set([])
              ui$.queueModalOpen.set(false)
            }}
          >
            <NouText className="py-1 px-5 text-center border border-gray-600 rounded-full">Clear</NouText>
          </TouchableOpacity>
        </View>
        <FlatList
          data={queue}
          keyExtractor={(item) => item.url}
          renderItem={({ item, index }) => <QueueItem bookmark={item} playing={playingIndex == index} />}
        />
      </BaseModal>
    )
  )
}
