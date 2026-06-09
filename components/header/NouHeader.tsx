import { ActivityIndicator, Pressable, ScrollView, useColorScheme, useWindowDimensions, View } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { colors } from '@/lib/colors'
import { NouMenu } from '../menu/NouMenu'
import { TabContextMenu } from '../menu/TabContextMenu'
import { clsx, isIos, isWeb, nIf } from '@/lib/utils'
import { ui$, updateUrl } from '@/states/ui'
import { bookmarks$ } from '@/states/bookmarks'
import { getPageType } from '@/lib/page'
import { toggleStar } from '@/lib/bookmarks'
import { queue$ } from '@/states/queue'
import { share } from '@/lib/share'
import { MaterialButton, MaterialCommunityButton } from '../button/IconButtons'
import { library$ } from '@/states/library'
import { normalizeUrl } from '@/lib/url'
import { useEffect, useState } from 'react'
import { t } from 'i18next'
import { hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'
import { useSleepTimerStatus } from '@/lib/sleep-timer'
import { NouText } from '../NouText'
import { formatPlaybackRate } from '@/lib/playback-rate'
import { formatPlaybackQuality } from '@/lib/playback-quality'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Image } from 'expo-image'

import { downloads$ } from '@/states/downloads'
import { tabs$, type Tab } from '@/states/tabs'
import { buildUserScriptExecutionSource } from '@/lib/user-styles'
import { userStyles$ } from '@/states/user-styles'
import { useHeaderAnimation } from './header-animation'
import { useActivePageUrl } from '@/lib/hooks/useActivePageUrl'

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

export const NouHeader: React.FC<{ getNoutube: () => any }> = ({ getNoutube }) => {
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const autoHideSidebar = useValue(settings$.autoHideSidebar)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const headerPosition = useValue(settings$.headerPosition)
  const desktopModeYTMusic = useValue(settings$.desktopMode)
  const desktopModeYT = useValue(settings$.desktopModeYT)
  const playbackRate = useValue(settings$.playbackRate)
  const playbackQuality = useValue(settings$.playbackQuality)
  const showBackButtonInHeader = useValue(settings$.showBackButtonInHeader)
  const showForwardButtonInHeader = useValue(settings$.showForwardButtonInHeader)
  const showHomeButtonInHeader = useValue(settings$.showHomeButtonInHeader)
  const showReloadButtonInHeader = useValue(settings$.showReloadButtonInHeader)
  const showPlaybackSpeedControl = useValue(settings$.showPlaybackSpeedControl)
  const showPlaybackQualityControl = useValue(settings$.showPlaybackQualityControl)
  const { width, height: windowHeight } = useWindowDimensions()
  const headerHeight = useValue(ui$.headerHeight)
  const headerShown = useValue(ui$.headerShown)
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activeTab = tabs[activeTabIndex]
  const activePageUrl = useActivePageUrl()
  const isYTMusic = activePageUrl.includes('music.youtube.com')
  const desktopMode = isYTMusic ? desktopModeYTMusic : desktopModeYT
  const normalizedActivePageUrl = activePageUrl ? normalizeUrl(activePageUrl) : ''
  const feedsEnabled = useValue(settings$.feedsEnabled)
  const allStarred = useValue(library$.urls)
  const starred = normalizedActivePageUrl ? allStarred.has(normalizedActivePageUrl) : false
  const bookmark = useValue(bookmarks$.getBookmarkByUrl(normalizedActivePageUrl))
  const queueSize = useValue(queue$.size)
  const downloads = useValue(downloads$)
  const customScripts = useValue(userStyles$.customScripts)
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

  useEffect(() => {
    const webview = getNoutube()
    if (!isWeb || !webview) {
      return
    }
    try {
      setCanGoBack(Boolean(activeTab?.canGoBack ?? webview.canGoBack()))
      setCanGoForward(webview.canGoForward())
    } catch {
      // webview not dom-ready yet; canGoBack/canGoForward throw until then
    }
  }, [activeTab?.canGoBack, activePageUrl, activeTabIndex, getNoutube])

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
    const webview = getNoutube()
    if (typeof webview?.goBack === 'function') {
      webview.goBack()
    } else {
      webview?.executeJavaScript?.('history.back()')
    }
  }

  const goForward = () => {
    const webview = getNoutube()
    if (typeof webview?.goForward === 'function') {
      webview.goForward()
    } else {
      webview?.executeJavaScript?.('history.forward()')
    }
  }

  const reloadPage = () => {
    const webview = getNoutube()
    if (typeof webview?.reload === 'function') {
      webview.reload()
      return
    }
    webview?.executeJavaScript?.('document.location.reload()')
  }

  const onToggleStar = () => {
    if (starred && bookmark) {
      ui$.bookmarkModalBookmark.set(bookmark)
    } else {
      toggleStar(getNoutube(), starred)
    }
  }

  const { Root, style: animatedStyle } = useHeaderAnimation({
    autoHideHeader,
    headerHeight,
    headerPosition,
    headerShown,
    hideToolbarWhenScrolled,
    isHorizontal,
  })
  const playbackRateLabel = formatPlaybackRate(playbackRate)
  const playbackQualityLabel = formatPlaybackQuality(playbackQuality)
  const pinnedScripts = customScripts
    .filter((script) => script?.enabled && script.pinToHeader && script.js.trim())
    .map((script) => ({ ...script, js: script.js.trim() }))
  const leadingToolbarItemCount =
    1 +
    Number(!isYTMusic && feedsEnabled) +
    Number(showHomeButtonInHeader) +
    Number(!isWeb && showBackButtonInHeader) +
    Number(!isWeb && showForwardButtonInHeader) +
    Number(!isWeb && showReloadButtonInHeader) +
    Number(isWeb) * 2
  const trailingToolbarItemCount =
    1 +
    Number(isWeb) +
    Number(showPlaybackSpeedControl) +
    Number(showPlaybackQualityControl) +
    Number(sleepTimerSupported && sleepTimerActive) +
    Number(!isYTMusic && queueSize > 0) +
    Number(pageType?.type === 'watch' || hasDownloads) +
    Number(pageType?.canStar) +
    Number(pinnedScripts.length > 0)
  const compactToolbar = leadingToolbarItemCount + trailingToolbarItemCount > 6

  const runPinnedScript = (script: (typeof pinnedScripts)[number]) => {
    const webview = getNoutube()
    const source = buildUserScriptExecutionSource(script)
    try {
      void Promise.resolve(webview?.executeJavaScript?.(source)).catch((error) => {
        console.error('[NouTube user script execute] ' + script.name, error)
      })
    } catch (error) {
      console.error('[NouTube user script execute] ' + script.name, error)
    }
  }

  return (
    <Root
      style={animatedStyle}
      onLayout={(e) => ui$.headerHeight.set(e.nativeEvent.layout.height)}
      className={clsx(
        'bg-zinc-100 dark:bg-zinc-800 flex-row lg:flex-col justify-between px-2 py-1 lg:px-1 lg:py-2',
        isWeb &&
          autoHideSidebar &&
          'lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-20 lg:w-14 lg:-translate-x-12 lg:opacity-0 lg:shadow-xl lg:transition lg:duration-200 lg:ease-out lg:hover:translate-x-0 lg:hover:opacity-100 lg:focus-within:translate-x-0 lg:focus-within:opacity-100',
        (autoHideHeader || hideToolbarWhenScrolled) &&
          !isHorizontal &&
          clsx('absolute left-0 right-0 z-10', headerPosition === 'bottom' ? 'bottom-0' : 'top-0'),
      )}
    >
      <View className="flex-1 min-w-0 lg:flex-none lg:w-full">
        <ScrollView
          horizontal={!isWeb || !isHorizontal}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          className="min-w-0 lg:w-full"
          contentContainerClassName={clsx('flex-row lg:flex-col', compactToolbar ? 'gap-0' : 'gap-1')}
        >
          <MaterialButton
            name={isYTMusic ? 'library-music' : 'video-library'}
            onPress={() => ui$.libraryModalOpen.set(true)}
          />
          {nIf(
            !isYTMusic && feedsEnabled,
            <MaterialButton name="rss-feed" onPress={() => ui$.feedModalOpen.set(true)} />,
          )}
          {nIf(!isWeb && showBackButtonInHeader, <MaterialButton name="arrow-back" onPress={goBack} />)}
          {nIf(!isWeb && showForwardButtonInHeader, <MaterialButton name="arrow-forward" onPress={goForward} />)}
          {nIf(!isWeb && showReloadButtonInHeader, <MaterialButton name="refresh" onPress={reloadPage} />)}
          {nIf(showHomeButtonInHeader, <MaterialButton name="home" onPress={onOpenHome} />)}
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
        </ScrollView>
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
                <TabContextMenu
                  key={tab.id}
                  items={[
                    {
                      label: t('menus.duplicateTab', 'Duplicate Tab'),
                      handler: () => tabs$.duplicateTab(index),
                    },
                    ...(tabs.length > 1
                      ? [
                          {
                            label: t('menus.close', 'Close'),
                            color: 'red' as const,
                            handler: () => tabs$.closeTab(index),
                          },
                        ]
                      : []),
                  ]}
                >
                <div className="group relative shrink-0" title={getTabLabel(tab)}>
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
                </TabContextMenu>
              )
            })}
          </ScrollView>
        </View>,
      )}
      <View
        className={clsx(
          'flex flex-row lg:flex-col lg:pb-1 items-center shrink-0',
          compactToolbar ? 'gap-1' : 'gap-2',
        )}
      >
        {nIf(isWeb, <MaterialButton name="add" onPress={() => tabs$.openTab()} />)}
        {nIf(
          showPlaybackSpeedControl,
          <Pressable
            onPress={() => ui$.playbackSpeedModalOpen.set(true)}
            className="h-11 min-w-11 px-1 items-center justify-center shrink-0"
          >
            <View className="px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-200/80 dark:bg-zinc-700/80">
              <NouText className="text-xs font-medium">{playbackRateLabel}</NouText>
            </View>
          </Pressable>,
        )}
        {nIf(
          showPlaybackQualityControl,
          <Pressable
            onPress={() => ui$.playbackQualityModalOpen.set(true)}
            className="h-11 min-w-11 px-1 items-center justify-center shrink-0"
          >
            <View className="px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-200/80 dark:bg-zinc-700/80">
              <NouText className="text-xs font-medium">{playbackQualityLabel}</NouText>
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
        {nIf(
          pinnedScripts.length === 1,
          <MaterialCommunityButton name="puzzle-outline" onPress={() => runPinnedScript(pinnedScripts[0])} />,
        )}
        {nIf(
          pinnedScripts.length > 1,
          <NouMenu
            trigger={<MaterialCommunityButton name="puzzle-outline" />}
            items={pinnedScripts.map((script) => ({
              label: script.name,
              icon: <MaterialIcons name="code" size={18} color={headerControlColor} />,
              systemImage: 'chevron.left.forwardslash.chevron.right',
              handler: () => runPinnedScript(script),
            }))}
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
              handler: reloadPage,
            },
            ...(isWeb && (pageType?.type === 'watch' || pageType?.type === 'shorts')
              ? [
                  {
                    label: t('menus.pip'),
                    icon: <MaterialIcons name="picture-in-picture-alt" size={18} color={headerControlColor} />,
                    systemImage: 'pip',
                    handler: () => {
                      getNoutube()?.executeJavaScript?.(
                        `(() => {
                          const video = document.querySelector('video');
                          if (video) {
                            if (document.pictureInPictureElement) {
                              document.exitPictureInPicture().catch(console.error);
                            } else {
                              video.requestPictureInPicture().catch(console.error);
                            }
                          }
                        })()`,
                        true,
                      )
                    },
                  },
                ]
              : []),
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
                      getNoutube()?.executeJavaScript?.('document.location.reload()')
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
