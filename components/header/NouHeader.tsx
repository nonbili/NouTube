import { ActivityIndicator, Pressable, ScrollView, useColorScheme, useWindowDimensions, View } from 'react-native'
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
import { Image } from 'expo-image'

import { downloads$ } from '@/states/downloads'
import { tabs$, type Tab } from '@/states/tabs'

const getTabLabel = (tab: { title?: string; pageUrl?: string; url?: string }) => {
  if (tab.title) {
    return tab.title
  }
  try {
    const url = new URL(tab.pageUrl || tab.url || '')
    if (url.pathname === '/' || !url.pathname) {
      return url.host
    }
    return url.pathname.replace(/^\//, '') || url.host
  } catch {
    return tab.pageUrl || tab.url || 'New Tab'
  }
}

const TabFavicon: React.FC<{ tab: Tab; color: string }> = ({ tab, color }) => {
  const [errored, setErrored] = useState(false)
  useEffect(() => setErrored(false), [tab.icon])
  if (tab.icon && !errored) {
    return (
      <Image
        source={tab.icon}
        style={{ width: 18, height: 18 }}
        contentFit="contain"
        onError={() => setErrored(true)}
      />
    )
  }
  return (
    <MaterialIcons
      name={tab.url.includes('music.youtube.com') ? 'library-music' : 'smart-display'}
      size={18}
      color={color}
    />
  )
}

export const NouHeader: React.FC<{ noutube: any }> = ({ noutube }) => {
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const headerPosition = useValue(settings$.headerPosition)
  const desktopModeYTMusic = useValue(settings$.desktopMode)
  const desktopModeYT = useValue(settings$.desktopModeYT)
  const playbackRate = useValue(settings$.playbackRate)
  const showBackButtonInHeader = useValue(settings$.showBackButtonInHeader)
  const showForwardButtonInHeader = useValue(settings$.showForwardButtonInHeader)
  const showHomeButtonInHeader = useValue(settings$.showHomeButtonInHeader)
  const showPlaybackSpeedControl = useValue(settings$.showPlaybackSpeedControl)
  const { width, height: windowHeight } = useWindowDimensions()
  const uiState = useValue(ui$)
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activeTab = tabs[activeTabIndex]
  const activePageUrl = activeTab?.pageUrl || activeTab?.url || uiState.pageUrl
  const isYTMusic = activePageUrl.includes('music.youtube.com')
  const desktopMode = isYTMusic ? desktopModeYTMusic : desktopModeYT
  const normalizedActivePageUrl = activePageUrl ? normalizeUrl(activePageUrl) : ''
  const feedsEnabled = useValue(settings$.feedsEnabled)
  const allStarred = useValue(library$.urls)
  const starred = normalizedActivePageUrl ? allStarred.has(normalizedActivePageUrl) : false
  const bookmark = useValue(bookmarks$.getBookmarkByUrl(normalizedActivePageUrl))
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
    try {
      setCanGoBack(Boolean(activeTab?.canGoBack ?? uiState.webview.canGoBack()))
      setCanGoForward(uiState.webview.canGoForward())
    } catch {
      // webview not dom-ready yet; canGoBack/canGoForward throw until then
    }
  }, [activeTab?.canGoBack, activePageUrl, uiState.webview])

  const pageType = getPageType(activePageUrl)

  const onToggleHome = () => {
    let newUrl = 'https://music.youtube.com'
    if (isYTMusic) {
      newUrl = isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com'
    }
    updateUrl(newUrl)
  }

  const onOpenHome = () => {
    updateUrl(isYTMusic ? 'https://music.youtube.com/' : isWeb ? 'https://www.youtube.com/' : 'https://m.youtube.com/')
  }

  const goBack = () => {
    if (typeof uiState.webview?.goBack === 'function') {
      uiState.webview.goBack()
    } else {
      uiState.webview?.executeJavaScript?.('history.back()')
    }
  }

  const goForward = () => {
    if (typeof uiState.webview?.goForward === 'function') {
      uiState.webview.goForward()
    } else {
      uiState.webview?.executeJavaScript?.('history.forward()')
    }
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
    const hiddenOffset = headerPosition === 'bottom' ? uiState.headerHeight : -uiState.headerHeight
    const next = shouldHide ? hiddenOffset : 0
    translateY.value = withTiming(next)
  }, [uiState.headerShown, uiState.headerHeight, autoHideHeader, hideToolbarWhenScrolled, headerPosition, isHorizontal, translateY])

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
        (autoHideHeader || hideToolbarWhenScrolled) &&
          !isHorizontal &&
          clsx('absolute left-0 right-0 z-10', headerPosition === 'bottom' ? 'bottom-0' : 'top-0'),
      )}
    >
      <View className="flex-row lg:flex-col">
        {nIf(!isWeb && showBackButtonInHeader, <MaterialButton name="arrow-back" onPress={goBack} />)}
        {nIf(!isWeb && showForwardButtonInHeader, <MaterialButton name="arrow-forward" onPress={goForward} />)}
        {nIf(showHomeButtonInHeader, <MaterialButton name="home" onPress={onOpenHome} />)}
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
              onPress={goBack}
            />
            <MaterialButton
              color={canGoForward ? headerControlColor : isDark ? colors.underlay : '#94a3b8'}
              name="arrow-forward"
              disabled={!canGoForward}
              onPress={goForward}
            />
          </>,
        )}
      </View>
      {nIf(
        isWeb,
        <View className="flex-1 min-w-0 lg:w-full lg:min-h-0">
          <ScrollView
            horizontal={!isHorizontal}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            className="min-w-0"
            contentContainerClassName="items-center gap-1 px-1 lg:flex-col lg:items-center lg:px-0 lg:py-1"
          >
            {tabs.map((tab, index) => {
              const active = index === activeTabIndex
              return (
                <div key={tab.id} className="group relative shrink-0" title={getTabLabel(tab)}>
                  <Pressable
                    onPress={() => tabs$.setActiveTabIndex(index)}
                    className={clsx(
                      'h-9 w-9 items-center justify-center rounded-lg',
                      active
                        ? 'bg-white shadow-sm dark:bg-zinc-700'
                        : 'hover:bg-zinc-200 dark:hover:bg-zinc-700/60',
                    )}
                  >
                    {tab.isLoading ? (
                      <ActivityIndicator size="small" color={headerControlColor} />
                    ) : (
                      <TabFavicon tab={tab} color={headerControlColor} />
                    )}
                  </Pressable>
                  {tabs.length > 1 && (
                    <div
                      title={t('menus.close', 'Close')}
                      className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-300 group-hover:flex dark:bg-zinc-600"
                      onClick={(event) => {
                        event.stopPropagation()
                        tabs$.closeTab(index)
                      }}
                    >
                      <MaterialIcons name="close" size={10} color={headerControlColor} />
                    </div>
                  )}
                </div>
              )
            })}
          </ScrollView>
        </View>,
      )}
      <View className="flex flex-row lg:flex-col lg:pb-1 items-center gap-2">
        {nIf(isWeb, <MaterialButton name="add" onPress={() => tabs$.openTab()} />)}
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
                ui$.toolsModalUrl.set(activePageUrl)
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
            ...(!isWeb
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
                      const key = isYTMusic ? settings$.desktopMode : settings$.desktopModeYT
                      key.set(!desktopMode)
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
              handler: () => share(activePageUrl),
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
