import { View, TouchableOpacity } from 'react-native'
import { BaseCenterModal } from './BaseCenterModal'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { use$ } from '@legendapp/state/react'
import { clsx } from '@/lib/utils'

const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

export const PlaybackSpeedModal = () => {
  const playbackSpeedModalOpen = use$(ui$.playbackSpeedModalOpen)
  const currentRate = use$(ui$.playbackRate)

  const onSelect = (rate: number) => {
    ui$.webview.get()?.executeJavaScript(`NouTube.setPlaybackRate(${rate})`)
    ui$.playbackSpeedModalOpen.set(false)
  }

  if (!playbackSpeedModalOpen) return null

  return (
    <BaseCenterModal onClose={() => ui$.playbackSpeedModalOpen.set(false)}>
        <View className="p-6">
            <NouText className="text-xl font-bold mb-6 text-center">Playback Speed</NouText>
            <View className="flex-row flex-wrap justify-center gap-3">
                {rates.map(rate => (
                    <TouchableOpacity
                        key={rate}
                        onPress={() => onSelect(rate)}
                        className={clsx(
                            "py-3 px-4 rounded-lg min-w-[70px] items-center",
                            currentRate === rate ? "bg-indigo-600" : "bg-zinc-800"
                        )}
                    >
                        <NouText className={clsx("font-medium", currentRate === rate ? "text-white" : "text-gray-200")}>
                            {rate}x
                        </NouText>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    </BaseCenterModal>
  )
}
