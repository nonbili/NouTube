import { View } from 'react-native'
import { BaseCenterModal } from './BaseCenterModal'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { NouText } from '../NouText'
import { useValue } from '@legendapp/state/react'
import { clsx } from '@/lib/utils'
import { formatPlaybackRate, playbackRates } from '@/lib/playback-rate'
import { NouButton } from '../button/NouButton'

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
        <View className="mt-6 flex-row flex-wrap justify-center gap-x-3 gap-y-4">
          {playbackRates.map((rate) => {
            const active = currentRate === rate
            return (
              <NouButton
                key={rate}
                onPress={() => onSelect(rate)}
                variant={active ? 'solid' : 'outline'}
                size="1"
                className={clsx(
                  'min-w-[72px] rounded-xl items-center justify-center',
                  active
                    ? 'bg-indigo-600 dark:bg-indigo-500'
                    : 'border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900',
                )}
                textClassName={active ? 'text-white' : 'text-zinc-800 dark:text-zinc-200'}
              >
                {formatPlaybackRate(rate)}
              </NouButton>
            )
          })}
        </View>
      </View>
    </BaseCenterModal>
  )
}
