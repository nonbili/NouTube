import { TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { use$, useObserveEffect } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { NouText } from '../NouText'
import { colors } from '@/lib/colors'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { NouMenu } from '../menu/NouMenu'
import { clsx, isIos, isWeb, nIf } from '@/lib/utils'
import { ui$, updateUrl } from '@/states/ui'
import { bookmarks$ } from '@/states/bookmarks'
import { getPageType } from '@/lib/page'
import { toggleStar } from '@/lib/bookmarks'
import { queue$ } from '@/states/queue'
import { share } from '@/lib/share'
import { MaterialButton } from '../button/IconButtons'
import { library$ } from '@/states/library'
import { normalizeUrl } from '@/lib/url'
import { useEffect, useState } from 'react'
import { t } from 'i18next'

export const NouHeader: React.FC<{ noutube: any }> = ({ noutube }) => {
  const isYTMusic = use$(settings$.isYTMusic)
  const { width } = useWindowDimensions()
  const uiState = use$(ui$)
  const feedsEnabled = use$(settings$.feedsEnabled)
  const allStarred = use$(library$.urls)
  const starred = allStarred.has(normalizeUrl(uiState.pageUrl))
  const bookmark = use$(bookmarks$.getBookmarkByUrl(normalizeUrl(uiState.pageUrl)))
  const queueSize = use$(queue$.size)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    if (!isWeb || !uiState.webview) {
      return
    }
    setCanGoBack(uiState.webview.canGoBack())
    setCanGoForward(uiState.webview.canGoForward())
  }, [uiState.pageUrl, uiState.webview])

  const pageType = getPageType(uiState.pageUrl)

  const onToggleHome = () => {
    let newUrl = 'https://music.youtube.com'
    if (isYTMusic) {
      newUrl = isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com'
    }
    updateUrl(newUrl)
  }

  const onToggleStar = () => {
    if (starred && bookmark) {
      ui$.bookmarkModalBookmark.set(bookmark)
    } else {
      toggleStar(noutube, starred)
    }
  }

  return (
    <>
      <View className="bg-zinc-800 flex-row lg:flex-col justify-between px-2 py-1 lg:px-1 lg:py-2">
        <View className="flex-row lg:flex-col">
          <MaterialButton
            name={isYTMusic ? 'library-music' : 'video-library'}
            onPress={() => ui$.libraryModalOpen.set(true)}
          />
          {nIf(
            !isYTMusic && feedsEnabled,
            <MaterialButton name="rss-feed" onPress={() => ui$.feedModalOpen.set(true)} />,
          )}
          {nIf(
            isWeb,
            <>
              <View className="h-2 w-2" />
              <MaterialButton
                color={canGoBack ? colors.icon : colors.underlay}
                name="arrow-back"
                disabled={!canGoBack}
                onPress={() => uiState.webview.goBack()}
              />
              <MaterialButton
                color={canGoForward ? colors.icon : colors.underlay}
                name="arrow-forward"
                disabled={!canGoForward}
                onPress={() => uiState.webview.goForward()}
              />
            </>,
          )}
        </View>
        <View className="flex flex-row lg:flex-col lg:pb-1 items-center gap-2">
          {nIf(
            !isYTMusic && queueSize > 0,
            <MaterialButton name="playlist-play" onPress={() => ui$.queueModalOpen.set(!ui$.queueModalOpen.get())} />,
          )}
          {nIf(
            pageType?.canStar,
            <MaterialButton
              color={starred ? 'gold' : colors.icon}
              name={starred ? 'star' : 'star-outline'}
              onPress={onToggleStar}
            />,
          )}
          <NouMenu
            trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
            items={[
              { label: isYTMusic ? 'YouTube' : 'YouTube Music', handler: onToggleHome },
              { label: t('modals.history'), handler: () => ui$.historyModalOpen.set(true) },
              {
                label: t('menus.reload'),
                handler: () => uiState.webview.executeJavaScript('document.location.reload()'),
              },
              { label: t('menus.share'), handler: () => share(uiState.pageUrl) },
              { label: t('settings.label'), handler: () => ui$.settingsModalOpen.set(true) },
            ]}
          />
        </View>
      </View>
    </>
  )
}
