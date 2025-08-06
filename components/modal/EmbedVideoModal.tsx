import { Modal, Text, Pressable, View, Switch, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { NouText } from '../NouText'
import { NouLink } from '../NouLink'
import { version } from '../../package.json'
import { useRef, useState } from 'react'
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
import { NouTubeView } from '@/modules/nou-tube-view'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'About']
const themes = [null, 'dark', 'light'] as const

export const EmbedVideoModal: React.FC<{ videoId: string; scriptOnStart: string; onClose: () => void }> = ({
  videoId,
  scriptOnStart,
  onClose,
}) => {
  const insets = useSafeAreaInsets()
  const ref = useRef<any>(null)
  const onLoad = () => {
    ref.current?.eval("document.querySelector('#movie_player')?.playVideo()")
    ref.current?.eval('NouTube.playDefaultAudio()')
  }
  const onMessage = async (e: { nativeEvent: { payload: string } }) => {}

  const url = `https://www.youtube.com/embed/${videoId}`

  return (
    <View className="absolute inset-0">
      <View className="flex-1 bg-[#222]" style={{ paddingBottom: insets.bottom }}>
        <NouTubeView
          // @ts-expect-error ??
          ref={ref}
          style={{ flex: 1 }}
          url={url}
          scriptOnStart={scriptOnStart}
          onLoad={onLoad}
          onMessage={onMessage}
        />
        <View className="items-center mt-8 mb-4">
          <TouchableOpacity onPress={onClose}>
            <NouText className="py-2 px-6 text-center bg-gray-700 rounded-full">Close</NouText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
