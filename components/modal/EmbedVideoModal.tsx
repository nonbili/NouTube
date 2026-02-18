import { Modal, Text, Pressable, View, Switch, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { NouText } from '../NouText'
import { useEffect, useRef, useState } from 'react'
import { NouTubeView } from '@/modules/nou-tube-view'
import { resolveUserAgent } from '@/lib/useragent'
import { settings$ } from '@/states/settings'
import { useValue } from '@legendapp/state/react'
import { isWeb } from '@/lib/utils'

const repo = 'https://github.com/nonbili/NouTube'
const tabs = ['Settings', 'About']
const themes = [null, 'dark', 'light'] as const

export const EmbedVideoModal: React.FC<{ videoId: string; scriptOnStart: string; onClose: () => void }> = ({
  videoId,
  scriptOnStart,
  onClose,
}) => {
  const customUserAgent = useValue(settings$.userAgent)
  const userAgent = resolveUserAgent(isWeb ? window.electron.process.platform : 'android', customUserAgent)
  const url = `https://www.youtube.com/embed/${videoId}`
  const ref = useRef<any>(null)
  useEffect(() => {
    ref.current?.loadUrl(url)
  }, [ref])

  const onLoad = () => {
    ref.current?.executeJavaScript('NouTube.playDefaultAudio()')
  }
  const onMessage = async (e: { nativeEvent: { payload: string } }) => {}

  return (
    <View className="absolute inset-0">
      <View className="flex-1 bg-zinc-800">
        <NouTubeView
          ref={ref}
          style={{ flex: 1 }}
          useragent={userAgent}
          scriptOnStart={scriptOnStart}
          onLoad={onLoad}
          onMessage={onMessage}
        />
        <View className="items-center my-4">
          <TouchableOpacity onPress={onClose}>
            <NouText className="py-2 px-6 text-center bg-gray-700 rounded-full">Close</NouText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}
