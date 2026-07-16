import { Pressable, View } from 'react-native'
import { useState } from 'react'
import { BaseCenterModal } from './BaseCenterModal'
import { ui$ } from '@/states/ui'
import { NouText } from '../NouText'
import { useValue } from '@legendapp/state/react'
import { share } from '@/lib/share'
import { fixSharingUrl } from '@/lib/page'
import { nIf } from '@/lib/utils'
import MaterialIcons from '@react-native-vector-icons/material-icons'

import { t } from 'i18next'

/* player.getVideoUrl() already embeds the current position as ?t= */
const getPosition = (videoUrl: string) => {
  try {
    const time = Number(new URL(videoUrl).searchParams.get('t'))
    return Number.isFinite(time) && time > 0 ? time : 0
  } catch {
    return 0
  }
}

const withoutPosition = (videoUrl: string) => {
  try {
    const url = new URL(videoUrl)
    url.searchParams.delete('t')
    return url.href
  } catch {
    return videoUrl
  }
}

const ShareModalContent: React.FC<{ pageUrl: string; videoUrl: string }> = ({ pageUrl, videoUrl }) => {
  const [includePosition, setIncludePosition] = useState(false)
  const onClose = () => ui$.shareModalUrls.set(null)
  const videoTime = getPosition(videoUrl)

  const options = [
    { label: t('modals.sharePageUrl', 'Page URL'), icon: 'language' as const, url: pageUrl },
    {
      label: t('modals.shareVideoUrl', 'Video URL'),
      icon: 'smart-display' as const,
      url: includePosition ? videoUrl : withoutPosition(videoUrl),
    },
  ]

  return (
    <BaseCenterModal onClose={onClose} containerClassName="w-[24rem] max-w-[88vw]">
      <View className="p-6">
        <NouText className="text-lg font-semibold text-center">{t('menus.share')}</NouText>
        <View className="mt-4 gap-3">
          {options.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                onClose()
                share(option.url)
              }}
              className="flex-row items-center gap-3 rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-4 py-3"
            >
              <MaterialIcons name={option.icon} size={22} color="#71717a" />
              <View className="flex-1">
                <NouText className="font-medium">{option.label}</NouText>
                <NouText className="mt-1 text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                  {fixSharingUrl(option.url)}
                </NouText>
              </View>
            </Pressable>
          ))}
          {nIf(
            videoTime > 0,
            <Pressable
              onPress={() => setIncludePosition(!includePosition)}
              className="flex-row items-center gap-2 px-1"
            >
              <MaterialIcons
                name={includePosition ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={includePosition ? '#6366f1' : '#71717a'}
              />
              <NouText className="text-sm">{t('modals.shareIncludePosition', 'Include current position')}</NouText>
            </Pressable>,
          )}
        </View>
      </View>
    </BaseCenterModal>
  )
}

export const ShareModal = () => {
  const shareModalUrls = useValue(ui$.shareModalUrls)

  if (!shareModalUrls) {
    return null
  }

  return <ShareModalContent {...shareModalUrls} />
}
