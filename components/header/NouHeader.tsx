import { Pressable, useColorScheme, useWindowDimensions, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { colors } from '@/lib/colors'
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
import { hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'
import { useSleepTimerStatus } from '@/lib/sleep-timer'
import { NouText } from '../NouText'
import { formatPlaybackRate } from '@/lib/playback-rate'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { downloads$ } from '@/states/downloads'

export const NouHeader: React.FC<{ noutube: any }> = ({ noutube }) => {
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const isYTMusic = useValue(settings$.isYTMusic)
  const desktopMode = useValue(settings$.desktopMode)
  const playbackRate = useValue(settings$.playbackRate)
  const showPlaybackSpeedControl = useValue(settings$.showPlaybackSpeedControl)
  const { width, height: windowHeight } = useWindowDimensions()
  const uiState = useValue(ui$)
  const feedsEnabled = useValue(settings$.feedsEnabled)
  const allStarred = useValue(library$.urls)
  const starred = allStarred.has(normalizeUrl(uiState.pageUrl))
  const bookmark = useValue(bookmarks$.getBookmarkByUrl(normalizeUrl(uiState.pageUrl)))
  const queueSize = useValue(queue$.size)
  const downloads = useValue(downloads$)
  const hasDownloads = Object.keys(downloads).length > 0
  const isDownloading = Object.values(downloads).some((d) => d.phase === 'downloading')
  const sleepTimerSupported = hasSleepTimerNativeSupport()
  const { active: sleepTimerActive } = useSleepTimerStatus(sleepTimerSupported)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const isHorizontal = width > windowHeight
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const headerControlColor = isDark ? colors.icon : colors.iconLight
  const translateY = useSharedValue(0)

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

  useEffect(() => {
    if (isWeb) {
      return
    }
    const shouldHide = !isHorizontal && (autoHideHeader || hideToolbarWhenScrolled) && !uiState.headerShown
    const next = shouldHide ? -uiState.headerHeight : 0
    translateY.value = withTiming(next)
  }, [uiState.headerShown, uiState.headerHeight, autoHideHeader, hideToolbarWhenScrolled, isHorizontal, translateY])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    }
  }, [translateY])
  const playbackRateLabel = formatPlaybackRate(playbackRate)

  const Root = isWeb ? View : Animated.View

  return (
    <Root
      style={isWeb ? undefined : animatedStyle}
      onLayout={(e) => ui$.headerHeight.set(e.nativeEvent.layout.height)}
      className={clsx(
        'bg-zinc-100 dark:bg-zinc-800 flex-row lg:flex-col justify-between px-2 py-1 lg:px-1 lg:py-2',
        (autoHideHeader || hideToolbarWhenScrolled) && !isHorizontal && 'absolute top-0 left-0 right-0 z-10',
      )}
    >
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
              color={canGoBack ? headerControlColor : isDark ? colors.underlay : '#94a3b8'}
              name="arrow-back"
              disabled={!canGoBack}
              onPress={() => uiState.webview.goBack()}
            />
            <MaterialButton
              color={canGoForward ? headerControlColor : isDark ? colors.underlay : '#94a3b8'}
              name="arrow-forward"
              disabled={!canGoForward}
              onPress={() => uiState.webview.goForward()}
            />
          </>,
        )}
      </View>
      <View className="flex flex-row lg:flex-col lg:pb-1 items-center gap-2">
        {nIf(
          showPlaybackSpeedControl,
          <Pressable
            onPress={() => ui$.playbackSpeedModalOpen.set(true)}
            className="h-11 min-w-11 px-1 items-center justify-center"
          >
            <View className="px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-200/80 dark:bg-zinc-700/80">
              <NouText className="text-xs font-medium">{playbackRateLabel}</NouText>
            </View>
          </Pressable>,
        )}
        {nIf(
          sleepTimerSupported && sleepTimerActive,
          <MaterialButton name="bedtime" color="#60a5fa" onPress={() => ui$.sleepTimerModalOpen.set(true)} />,
        )}
        {nIf(
          !isYTMusic && queueSize > 0,
          <MaterialButton name="playlist-play" onPress={() => ui$.queueModalOpen.set(!ui$.queueModalOpen.get())} />,
        )}
        {nIf(
          pageType?.type === 'watch' || hasDownloads,
          <MaterialButton
            name="download"
            color={isDownloading ? '#60a5fa' : headerControlColor}
            onPress={() => {
              if (pageType?.type === 'watch') {
                ui$.toolsModalUrl.set(uiState.pageUrl)
              }
              ui$.toolsModalOpen.set(true)
            }}
          />,
        )}
        {nIf(
          pageType?.canStar,
          <MaterialButton
            color={starred ? 'gold' : headerControlColor}
            name={starred ? 'star' : 'star-outline'}
            onPress={onToggleStar}
          />,
        )}
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[
            {
              label: isYTMusic ? 'YouTube' : 'YouTube Music',
              icon: <MaterialIcons name={isYTMusic ? 'video-library' : 'library-music'} size={18} color={headerControlColor} />,
              systemImage: isYTMusic ? 'play.rectangle.stack' : 'music.note.house',
              handler: onToggleHome,
            },
            {
              label: t('modals.history'),
              icon: <MaterialIcons name="history" size={18} color={headerControlColor} />,
              systemImage: 'clock.arrow.circlepath',
              handler: () => ui$.historyModalOpen.set(true),
            },
            {
              label: t('menus.reload'),
              icon: <MaterialIcons name="refresh" size={18} color={headerControlColor} />,
              systemImage: 'arrow.clockwise',
              handler: () => uiState.webview.executeJavaScript('document.location.reload()'),
            },
            ...(isYTMusic && !isWeb
              ? [
                  {
                    label: t('menus.desktop'),
                    icon: <MaterialIcons name="desktop-windows" size={18} color={headerControlColor} />,
                    systemImage: 'desktopcomputer',
                    metaLabel: desktopMode ? t('menus.on') : t('menus.off'),
                    meta: (
                      <View
                        className={clsx(
                          'rounded-full px-2 py-1',
                          desktopMode
                            ? 'bg-indigo-500/20 border border-indigo-400/40'
                            : 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700',
                        )}
                      >
                        <NouText
                          className={clsx(
                            'text-[11px] font-medium',
                            desktopMode ? 'text-indigo-200' : 'text-zinc-400',
                          )}
                        >
                          {desktopMode ? t('menus.on') : t('menus.off')}
                        </NouText>
                      </View>
                    ),
                    handler: () => {
                      settings$.desktopMode.set(!desktopMode)
                      uiState.webview.executeJavaScript('document.location.reload()')
                    },
                  },
                ]
              : []),
            {
              label: 'Open URL',
              icon: <MaterialIcons name="link" size={18} color={headerControlColor} />,
              systemImage: 'link',
              handler: () => ui$.urlModalOpen.set(true),
            },
            {
              label: t('menus.share'),
              icon: <MaterialIcons name="share" size={18} color={headerControlColor} />,
              systemImage: 'square.and.arrow.up',
              handler: () => share(uiState.pageUrl),
            },
            {
              label: t('menus.tools', 'Tools'),
              icon: <MaterialIcons name="download" size={18} color={headerControlColor} />,
              systemImage: 'arrow.down.circle',
              handler: () => {
                ui$.toolsModalOpen.set(true)
              },
            },
            {
              label: t('settings.label'),
              icon: <MaterialIcons name="settings" size={18} color={headerControlColor} />,
              systemImage: 'gearshape',
              handler: () => ui$.settingsModalOpen.set(true),
            },
          ]}
        />
      </View>
    </Root>
  )
}
