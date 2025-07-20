import { Modal, Text, Pressable, View, Switch, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../NouLink'
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
import { getPageType } from '@/lib/page'
import { watchlist$ } from '@/states/watchlist'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { QueueItem } from '../queue/QueueItem'
import { queue$ } from '@/states/queue'
import { usePlayingQueueIndex } from '@/lib/queue'
import { ui$ } from '@/states/ui'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'About']
const themes = [null, 'dark', 'light'] as const

export const QueueModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [tabIndex, setTabIndex] = useState(0)
  const settings = use$(settings$)
  const [importing, setImporting] = useState(false)
  const insets = useSafeAreaInsets()
  const { playingIndex, size } = usePlayingQueueIndex()
  const queue = use$(queue$.bookmarks)

  const onClickImport = async () => {
    const res = await getDocumentAsync({ copyToCacheDirectory: true, type: 'text/*' })
    setImporting(true)
    try {
      const csv = res.assets?.[0]
      if (csv) {
        const res = await fetch(csv.uri)
        const text = await res.text()
        await importCsv(text)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setImporting(false)
    }
  }

  return (
    <View className="absolute inset-0">
      <View className="flex-1 bg-[#222]" style={{ paddingBottom: insets.bottom }}>
        <ScrollView className="flex-1">
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
                ui$.queueModalShown.set(false)
              }}
            >
              <NouText className="py-1 px-5 text-center border border-gray-600 rounded-full">Clear</NouText>
            </TouchableOpacity>
          </View>
          {queue.map((bookmark, index) => (
            <QueueItem bookmark={bookmark} playing={playingIndex == index} key={bookmark.url} />
          ))}
        </ScrollView>
        <View className="items-center mt-8 mb-4">
          <TouchableOpacity onPress={onClose}>
            <NouText className="py-2 px-6 text-center bg-gray-700 rounded-full">Close</NouText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
