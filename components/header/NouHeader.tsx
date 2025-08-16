import { TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { use$, useObserveEffect } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { NouText } from '../NouText'
import { colors } from '@/lib/colors'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { NouMenu } from '../menu/NouMenu'
import { isWeb } from '@/lib/utils'
import { ui$ } from '@/states/ui'
import { bookmarks$ } from '@/states/bookmarks'
import { getPageType, normalizeUrl } from '@/lib/page'
import { toggleStar } from '@/lib/bookmarks'
import { queue$ } from '@/states/queue'
import { share } from '@/lib/share'
import { MaterialButton } from '../button/MaterialButton'
import { library$ } from '@/states/library'

export const NouHeader: React.FC<{ noutube: any }> = ({ noutube }) => {
  const isYTMusic = use$(settings$.isYTMusic)
  const { width } = useWindowDimensions()
  const uiState = use$(ui$)
  const allStarred = use$(library$.urls)
  const starred = allStarred.has(normalizeUrl(uiState.pageUrl))
  const queueSize = use$(queue$.size)

  const pageType = getPageType(uiState.pageUrl)

  const onToggleHome = () => {
    let newUrl = 'https://music.youtube.com'
    if (isYTMusic) {
      newUrl = isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com'
    }
    ui$.url.set(newUrl)
  }

  const onToggleStar = () => toggleStar(noutube, starred)

  return (
    <>
      <View className="bg-zinc-800 flex flex-row lg:flex-col justify-between px-2 py-1 lg:px-1 lg:py-2">
        <View className="">
          <MaterialButton
            name={isYTMusic ? 'library-music' : 'video-library'}
            onPress={() => ui$.libraryModalOpen.set(true)}
          />
        </View>
        <View className="flex flex-row lg:flex-col lg:pb-1 items-center gap-2">
          {!isYTMusic && queueSize > 0 && (
            <MaterialButton name="playlist-play" onPress={() => ui$.queueModalOpen.set(!ui$.queueModalOpen.get())} />
          )}
          {pageType?.canStar && (
            <MaterialButton
              color={starred ? 'gold' : colors.icon}
              name={starred ? 'star' : 'star-outline'}
              onPress={onToggleStar}
            />
          )}
          <NouMenu
            trigger={<MaterialButton name="more-vert" />}
            items={[
              { label: isYTMusic ? 'YouTube' : 'YouTube Music', handler: onToggleHome },
              { label: 'Share', handler: () => share(uiState.pageUrl) },
              { label: 'Settings', handler: () => ui$.settingsModalOpen.set(true) },
            ]}
          />
        </View>
      </View>
    </>
  )
}
