import { View, Pressable } from 'react-native'
import { BaseCenterModal } from './BaseCenterModal'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { NouText } from '../NouText'
import { useValue } from '@legendapp/state/react'
import { clsx } from '@/lib/utils'
import { formatPlaybackRate, playbackRates } from '@/lib/playback-rate'

export const PlaybackSpeedModal = () => {
  const playbackSpeedModalOpen = useValue(ui$.playbackSpeedModalOpen)
  const currentRate = useValue(settings$.playbackRate)

  const onSelect = (rate: number) => {
    settings$.playbackRate.set(rate)
    ui$.webview.get()?.executeJavaScript(`window.NouTube.setPlaybackRate(${rate})`)
    ui$.playbackSpeedModalOpen.set(false)
  }

  if (!playbackSpeedModalOpen) {
    return null
  }

  return (
    <BaseCenterModal onClose={() => ui$.playbackSpeedModalOpen.set(false)} containerClassName="w-[24rem] max-w-[88vw]">
      <View className="p-6">
        <NouText className="text-lg font-semibold text-center">Playback speed</NouText>
        <View className="mt-5 flex-row flex-wrap justify-center gap-3">
          {playbackRates.map((rate) => {
            const active = currentRate === rate
            return (
              <Pressable
                key={rate}
                onPress={() => onSelect(rate)}
                className={clsx(
                  'min-w-[72px] rounded-xl border px-4 py-3 items-center',
                  active ? 'border-blue-500 bg-blue-600' : 'border-zinc-800 bg-zinc-900',
                )}
              >
                <NouText className={clsx('font-medium', active ? 'text-white' : 'text-zinc-200')}>
                  {formatPlaybackRate(rate)}
                </NouText>
              </Pressable>
            )
          })}
        </View>
      </View>
    </BaseCenterModal>
  )
}
