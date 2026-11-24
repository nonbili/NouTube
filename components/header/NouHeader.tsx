import { ActivityIndicator, Pressable, ScrollView, useColorScheme, useWindowDimensions, View } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'
import { colors } from '@/lib/colors'
import { NouMenu } from '../menu/NouMenu'
import { TabContextMenu } from '../menu/TabContextMenu'
import { clsx, isAndroid, isIos, isWeb, nIf } from '@/lib/utils'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { ui$, updateUrl } from '@/states/ui'
import { bookmarks$ } from '@/states/bookmarks'
import { getPageType, getVideoId } from '@/lib/page'
import { toggleStar } from '@/lib/bookmarks'
import { queue$ } from '@/states/queue'
import { share } from '@/lib/share'
import { MaterialButton, MaterialCommunityButton } from '../button/IconButtons'
import { library$ } from '@/states/library'
import { getBookmarkKey, normalizeUrl } from '@/lib/url'
import { Fragment, useEffect, useRef, useState } from 'react'
import { t } from 'i18next'
import { hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'
import { useSleepTimerStatus } from '@/lib/sleep-timer'
import { NouText } from '../NouText'
import { formatPlaybackRate, playbackRatesWith } from '@/lib/playback-rate'
import { formatPlaybackQuality, playbackQualities } from '@/lib/playback-quality'
import { selectPlaybackRate } from '../modal/PlaybackSpeedModal'
import { selectPlaybackQuality } from '../modal/PlaybackQualityModal'
import MaterialIcons, { type MaterialIconsIconName } from '@react-native-vector-icons/material-icons'
import { Image } from 'expo-image'

import { downloads$ } from '@/states/downloads'
import { tabs$, type Tab } from '@/states/tabs'
import { buildUserScriptExecutionSource } from '@/lib/user-styles'
import { userStyles$ } from '@/states/user-styles'
import { useHeaderAnimation } from './header-animation'
import { toolbarPillLabelClass, toolbarPillPressableClass } from './toolbar-classes'
import { ScrollFade } from './ScrollFade'
import { useActivePageUrl } from '@/lib/hooks/useActivePageUrl'
import { toggleDesktopMode, useDesktopMode } from '@/lib/hooks/useDesktopMode'
import {
  defaultToolbarButtonOrder,
  getToolbarButtonLabel,
  isPlaybackToolbarButton,
  playbackToolbarButtons,
  type PlaybackToolbarButtonId,
  type ToolbarButtonId,
} from '@/lib/toolbar-buttons'
import { navigateHistory } from '@/lib/history-navigation'
import { togglePictureInPicture } from '@/lib/picture-in-picture'
import { useTwColor } from '@/lib/theme'

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
  const tw = useTwColor()
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const autoHideSidebar = useValue(settings$.autoHideSidebar)
  const doubleTapToToggleHeader = useValue(settings$.doubleTapToToggleHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const headerPosition = useValue(settings$.headerPosition)
  const playbackRate = useValue(settings$.playbackRate)
  const playbackQuality = useValue(settings$.playbackQuality)
  const showBackButtonInHeader = useValue(settings$.showBackButtonInHeader)
  const showForwardButtonInHeader = useValue(settings$.showForwardButtonInHeader)
  const showHomeButtonInHeader = useValue(settings$.showHomeButtonInHeader)
  const showHistoryButtonInHeader = useValue(settings$.showHistoryButtonInHeader)
  const showReloadButtonInHeader = useValue(settings$.showReloadButtonInHeader)
  const showPlaybackSpeedControl = useValue(settings$.showPlaybackSpeedControl)
  const showPlaybackQualityControl = useValue(settings$.showPlaybackQualityControl)
  const showSleepTimerButtonInHeader = useValue(settings$.showSleepTimerButtonInHeader)
  const showLibraryButtonInHeader = useValue(settings$.showLibraryButtonInHeader)
  const showStarButtonInHeader = useValue(settings$.showStarButtonInHeader)
  const showQueueButtonInHeader = useValue(settings$.showQueueButtonInHeader)
  const showScriptsButtonInHeader = useValue(settings$.showScriptsButtonInHeader)
  const toolbarButtonOrder = useValue(settings$.toolbarButtonOrder)
  const toolbarMenuButtons = useValue(settings$.toolbarMenuButtons)
  const { width, height: windowHeight } = useWindowDimensions()
  const headerHeight = useValue(ui$.headerHeight)
  const headerShown = useValue(ui$.headerShown)
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activeTab = tabs[activeTabIndex]
  const activePageUrl = useActivePageUrl()
  const isYTMusic = activePageUrl.includes('music.youtube.com')
  const desktopMode = useDesktopMode(isYTMusic)
  const normalizedActivePageUrl = activePageUrl ? normalizeUrl(activePageUrl) : ''
  const feedsEnabled = useValue(settings$.feedsEnabled)
  const allStarred = useValue(library$.urls)
  const starred = activePageUrl ? allStarred.has(getBookmarkKey(activePageUrl)) : false
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
  // Which ends of the leading buttons are scrolled out of view.
  const [leadingOverflow, setLeadingOverflow] = useState({ start: false, end: false })
  const leadingScroll = useRef({ x: 0, view: 0, content: 0 })
  const isHorizontal = width > windowHeight
  // The vertical sidebar layout is desktop-only; on native a landscape window
  // keeps the horizontal toolbar, so it must keep hiding on scroll too.
  const isSidebarLayout = isWeb && isHorizontal
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const headerControlColor = isDark ? tw(colors.icon) : tw(colors.iconLight)

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
  const showPictureInPictureButton = isIos && (pageType?.type === 'watch' || pageType?.type === 'shorts')

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

  const goBack = () => navigateHistory(getNoutube(), 'back')

  const goForward = () => navigateHistory(getNoutube(), 'forward')

  const reloadPage = () => {
    const webview = getNoutube()
    if (typeof webview?.reload === 'function') {
      webview.reload()
      return
    }
    webview?.executeJavaScript?.('document.location.reload()')
  }

  const onShare = async () => {
    let videoUrl = ''
    try {
      videoUrl = (await getNoutube()?.executeJavaScript?.('window.NouTube?.getVideoUrl?.() || ""')) || ''
    } catch {
      // webview not ready; fall back to sharing the page url
    }
    const videoId = typeof videoUrl === 'string' ? getVideoId(videoUrl) : ''
    if (!videoId) {
      share(activePageUrl)
      return
    }
    ui$.shareModalUrls.set({ pageUrl: activePageUrl, videoUrl })
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
    doubleTapToToggleHeader: isAndroid && doubleTapToToggleHeader,
    headerHeight,
    headerPosition,
    headerShown,
    hideToolbarWhenScrolled,
    isSidebarLayout,
  })
  const playbackRateLabel = formatPlaybackRate(playbackRate)
  const playbackQualityLabel = formatPlaybackQuality(playbackQuality)
  const pinnedScripts = customScripts
    .filter((script) => script?.enabled && script.pinToHeader && script.js.trim())
    .map((script) => ({ ...script, js: script.js.trim() }))
  const showSleepTimerButton = sleepTimerSupported && (sleepTimerActive || showSleepTimerButtonInHeader)
  const showStarButton = Boolean(pageType?.canStar) && showStarButtonInHeader
  // Only Android has switches for these, so only Android hides them.
  const showQueueButton = !isYTMusic && queueSize > 0 && (!isAndroid || showQueueButtonInHeader)
  const showScriptsButton = pinnedScripts.length > 0 && (!isAndroid || showScriptsButtonInHeader)
  const showMenuButton = (id: ToolbarButtonId) => isAndroid && (toolbarMenuButtons as string[]).includes(id)
  // A Tools button the user placed takes over the download button, so there is only one.
  const showDownloadButton =
    !showMenuButton('tools') &&
    (!isIos || 'downloadVideo' in NouTubeViewModule) &&
    (pageType?.type === 'watch' || hasDownloads)
  const openDownload = () => {
    if (pageType?.type === 'watch') {
      ui$.toolsModalUrl.set(activePageUrl)
    }
    ui$.toolsModalOpen.set(true)
  }
  // Leading buttons by id; the web build has its own back/forward/reload group.
  const leadingButtons: Record<
    Exclude<ToolbarButtonId, PlaybackToolbarButtonId>,
    { icon: MaterialIconsIconName; color?: string; onPress: () => void } | null
  > = {
    library: showLibraryButtonInHeader
      ? { icon: isYTMusic ? 'library-music' : 'video-library', onPress: () => ui$.libraryModalOpen.set(true) }
      : null,
    feed: !isYTMusic && feedsEnabled ? { icon: 'rss-feed', onPress: () => ui$.feedModalOpen.set(true) } : null,
    back: !isWeb && showBackButtonInHeader ? { icon: 'arrow-back', onPress: goBack } : null,
    forward: !isWeb && showForwardButtonInHeader ? { icon: 'arrow-forward', onPress: goForward } : null,
    reload: !isWeb && showReloadButtonInHeader ? { icon: 'refresh', onPress: reloadPage } : null,
    home: showHomeButtonInHeader ? { icon: 'home', onPress: onOpenHome } : null,
    history: showHistoryButtonInHeader ? { icon: 'history', onPress: () => ui$.historyModalOpen.set(true) } : null,
    'switch-home': showMenuButton('switch-home')
      ? { icon: isYTMusic ? 'video-library' : 'library-music', onPress: onToggleHome }
      : null,
    'desktop-mode': showMenuButton('desktop-mode')
      ? {
          icon: 'desktop-windows',
          color: desktopMode ? tw('indigo-400') : undefined,
          onPress: () => toggleDesktopMode(isYTMusic),
        }
      : null,
    'open-url': showMenuButton('open-url') ? { icon: 'link', onPress: () => ui$.urlModalOpen.set(true) } : null,
    share: showMenuButton('share') ? { icon: 'share', onPress: () => void onShare() } : null,
    tools: showMenuButton('tools')
      ? { icon: 'download', color: isDownloading ? tw('blue-400') : undefined, onPress: openDownload }
      : null,
    settings: showMenuButton('settings') ? { icon: 'settings', onPress: () => ui$.settingsModalOpen.set(true) } : null,
  }
  const playbackButtonShown: Record<PlaybackToolbarButtonId, boolean> = {
    speed: showPlaybackSpeedControl,
    quality: showPlaybackQualityControl,
    'sleep-timer': showSleepTimerButton,
    queue: showQueueButton,
    scripts: showScriptsButton,
  }
  // Android shows the playback controls among the leading buttons; elsewhere they stay by the ⋮ menu.
  const isShown = (id: ToolbarButtonId) =>
    isPlaybackToolbarButton(id) ? playbackButtonShown[id] : Boolean(leadingButtons[id])
  const leadingButtonIds = (isAndroid ? toolbarButtonOrder : defaultToolbarButtonOrder).filter(
    (id) => isShown(id) && (isAndroid || !isPlaybackToolbarButton(id)),
  )
  const trailingPlaybackButtonIds = isAndroid ? [] : playbackToolbarButtons.filter(isShown)
  const leadingToolbarItemCount = leadingButtonIds.length + Number(isWeb) * (2 + Number(showReloadButtonInHeader))
  const trailingToolbarItemCount =
    1 +
    Number(isWeb) +
    trailingPlaybackButtonIds.length +
    Number(showDownloadButton) +
    Number(showPictureInPictureButton) +
    Number(showStarButton)
  const compactToolbar = leadingToolbarItemCount + trailingToolbarItemCount > 6
  const hideableHeader = autoHideHeader || hideToolbarWhenScrolled || (isAndroid && doubleTapToToggleHeader)

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

  // Without onPress the pill is a dropdown trigger: render a plain View so the
  // Radix trigger stays the only focus target and keyboard activation works.
  const renderPill = (label: string, onPress?: () => void) => {
    const pill = (
      <View className={toolbarPillLabelClass()}>
        <NouText className="text-xs font-medium">{label}</NouText>
      </View>
    )
    return onPress ? (
      <Pressable onPress={onPress} className={toolbarPillPressableClass()}>
        {pill}
      </Pressable>
    ) : (
      <View className={toolbarPillPressableClass()}>{pill}</View>
    )
  }

  const updateLeadingOverflow = (next: Partial<typeof leadingScroll.current>) => {
    const scroll = Object.assign(leadingScroll.current, next)
    const start = scroll.x > 1
    const end = scroll.x + scroll.view < scroll.content - 1
    setLeadingOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }
  const leadingHorizontal = !isWeb || !isHorizontal
  const headerBackground = tw(isDark ? 'zinc-800' : 'zinc-100')

  const menuCheck = (checked: boolean) =>
    checked ? <MaterialIcons name="check" size={16} color={headerControlColor} /> : undefined

  const playbackButtons: Record<PlaybackToolbarButtonId, () => React.ReactNode> = {
    speed: () =>
      isWeb ? (
        <NouMenu
          side={isSidebarLayout ? 'right' : undefined}
          trigger={renderPill(playbackRateLabel)}
          items={playbackRatesWith(playbackRate).map((rate) => ({
            label: formatPlaybackRate(rate),
            meta: menuCheck(rate === playbackRate),
            handler: () => selectPlaybackRate(rate),
          }))}
        />
      ) : (
        renderPill(playbackRateLabel, () => ui$.playbackSpeedModalOpen.set(true))
      ),
    quality: () =>
      isWeb ? (
        <NouMenu
          side={isSidebarLayout ? 'right' : undefined}
          trigger={renderPill(playbackQualityLabel)}
          items={playbackQualities.map((q) => ({
            label: q.label,
            meta: menuCheck(q.value === playbackQuality),
            handler: () => selectPlaybackQuality(q.value),
          }))}
        />
      ) : (
        renderPill(playbackQualityLabel, () => ui$.playbackQualityModalOpen.set(true))
      ),
    'sleep-timer': () => (
      <MaterialButton
        name="bedtime"
        color={sleepTimerActive ? tw('blue-400') : headerControlColor}
        accessibilityRole="button"
        accessibilityLabel={getToolbarButtonLabel('sleep-timer')}
        onPress={() => ui$.sleepTimerModalOpen.set(true)}
      />
    ),
    queue: () => (
      <MaterialButton
        color={headerControlColor}
        name="playlist-play"
        accessibilityRole="button"
        accessibilityLabel={getToolbarButtonLabel('queue')}
        onPress={() => ui$.queueModalOpen.set(!ui$.queueModalOpen.get())}
      />
    ),
    scripts: () =>
      pinnedScripts.length === 1 ? (
        <MaterialCommunityButton
          color={headerControlColor}
          name="puzzle-outline"
          onPress={() => runPinnedScript(pinnedScripts[0])}
        />
      ) : (
        <NouMenu
          trigger={<MaterialCommunityButton color={headerControlColor} name="puzzle-outline" />}
          items={pinnedScripts.map((script) => ({
            label: script.name,
            icon: <MaterialIcons name="code" size={18} color={headerControlColor} />,
            systemImage: 'chevron.left.forwardslash.chevron.right',
            handler: () => runPinnedScript(script),
          }))}
        />
      ),
  }

  return (
    <Root
      style={animatedStyle}
      onLayout={(e) => ui$.headerHeight.set(e.nativeEvent.layout.height)}
      className={clsx(
        'bg-zinc-100 dark:bg-zinc-800 flex-row justify-between px-2 py-1',
        isWeb && 'lg:w-14 lg:flex-none lg:flex-col lg:px-1 lg:py-2',
        isWeb &&
          autoHideSidebar &&
          'lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:z-20 lg:w-14 lg:-translate-x-12 lg:opacity-0 lg:shadow-xl lg:transition lg:duration-200 lg:ease-out lg:hover:translate-x-0 lg:hover:opacity-100 lg:focus-within:translate-x-0 lg:focus-within:opacity-100',
        hideableHeader &&
          (!isSidebarLayout || (isAndroid && doubleTapToToggleHeader)) &&
          clsx('absolute left-0 right-0 z-10', headerPosition === 'bottom' ? 'bottom-0' : 'top-0'),
      )}
    >
      <View className={clsx('flex-1 min-w-0', isWeb && 'lg:flex-none lg:w-full')}>
        <ScrollView
          horizontal={leadingHorizontal}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => updateLeadingOverflow({ x: e.nativeEvent.contentOffset.x })}
          // The throttle can drop the last scroll event at an edge.
          onScrollEndDrag={(e) => updateLeadingOverflow({ x: e.nativeEvent.contentOffset.x })}
          onMomentumScrollEnd={(e) => updateLeadingOverflow({ x: e.nativeEvent.contentOffset.x })}
          onLayout={(e) => updateLeadingOverflow({ view: e.nativeEvent.layout.width })}
          onContentSizeChange={(content) => updateLeadingOverflow({ content })}
          className={clsx('min-w-0', isWeb && 'lg:w-full')}
          contentContainerClassName={clsx(
            'flex-row items-center',
            isWeb && 'lg:flex-col',
            compactToolbar ? 'gap-0' : 'gap-1',
          )}
        >
          {leadingButtonIds.map((id) => {
            if (isPlaybackToolbarButton(id)) {
              return <Fragment key={id}>{playbackButtons[id]()}</Fragment>
            }
            const button = leadingButtons[id]!
            return (
              <MaterialButton
                key={id}
                color={button.color ?? headerControlColor}
                name={button.icon}
                onPress={button.onPress}
                accessibilityRole="button"
                accessibilityLabel={
                  id === 'switch-home' ? (isYTMusic ? 'YouTube' : 'YouTube Music') : getToolbarButtonLabel(id)
                }
              />
            )
          })}
          {nIf(
            isWeb,
            <>
              <View className="h-2 w-2" />
              <MaterialButton
                color={canGoBack ? headerControlColor : isDark ? tw(colors.underlay) : tw('slate-400')}
                name="arrow-back"
                disabled={!canGoBack}
                onPress={goBack}
              />
              <MaterialButton
                color={canGoForward ? headerControlColor : isDark ? tw(colors.underlay) : tw('slate-400')}
                name="arrow-forward"
                disabled={!canGoForward}
                onPress={goForward}
              />
              {nIf(showReloadButtonInHeader, <MaterialButton color={headerControlColor} name="refresh" onPress={reloadPage} />)}
            </>,
          )}
        </ScrollView>
        {nIf(
          leadingHorizontal,
          <>
            <ScrollFade side="left" color={headerBackground} visible={leadingOverflow.start} />
            <ScrollFade side="right" color={headerBackground} visible={leadingOverflow.end} />
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
                <TabContextMenu
                  key={tab.id}
                  items={[
                    {
                      label: t('menus.duplicateTab', 'Duplicate Tab'),
                      icon: <MaterialIcons name="content-copy" size={16} color={headerControlColor} />,
                      handler: () => tabs$.duplicateTab(index),
                    },
                    ...(tabs.length > 1
                      ? [
                          {
                            label: t('menus.close', 'Close'),
                            color: 'red' as const,
                            icon: <MaterialIcons name="close" size={16} color={isDark ? '#f87171' : '#dc2626'} />,
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
          'flex flex-row items-center shrink-0',
          isWeb && 'lg:flex-col lg:pb-1',
          compactToolbar ? 'gap-1' : 'gap-2',
        )}
      >
        {nIf(isWeb, <MaterialButton color={headerControlColor} name="add" onPress={() => tabs$.openTab()} />)}
        {trailingPlaybackButtonIds
          .filter((id) => id !== 'scripts')
          .map((id) => (
            <Fragment key={id}>{playbackButtons[id]()}</Fragment>
          ))}
        {nIf(
          showDownloadButton,
          <MaterialButton
            name="download"
            color={isDownloading ? tw('blue-400') : headerControlColor}
            onPress={openDownload}
          />,
        )}
        {nIf(
          showPictureInPictureButton,
          <MaterialButton
            name="picture-in-picture-alt"
            color={headerControlColor}
            accessibilityRole="button"
            accessibilityLabel={t('menus.pip')}
            testID="header-pip"
            onPress={() => void togglePictureInPicture(getNoutube())}
          />,
        )}
        {nIf(
          showStarButton,
          <MaterialButton
            color={starred ? 'gold' : headerControlColor}
            name={starred ? 'star' : 'star-outline'}
            onPress={onToggleStar}
          />,
        )}
        {nIf(trailingPlaybackButtonIds.includes('scripts'), playbackButtons.scripts())}
        <NouMenu
          trigger={
            isWeb ? <MaterialButton color={headerControlColor} name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'
          }
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
            // With its toolbar button switched off, the queue is still reachable here.
            ...(!isYTMusic && queueSize > 0 && !showQueueButton
              ? [
                  {
                    label: t('settings.toolbarButton.queue'),
                    icon: <MaterialIcons name="playlist-play" size={18} color={headerControlColor} />,
                    systemImage: 'list.bullet',
                    handler: () => ui$.queueModalOpen.set(true),
                  },
                ]
              : []),
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
                    handler: () => toggleDesktopMode(isYTMusic),
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
              handler: () => void onShare(),
            },
            ...(isIos && !('downloadVideo' in NouTubeViewModule)
              ? []
              : [
                  {
                    label: t('menus.tools', 'Tools'),
                    icon: <MaterialIcons name="download" size={18} color={headerControlColor} />,
                    systemImage: 'arrow.down.circle',
                    handler: () => {
                      ui$.toolsModalOpen.set(true)
                    },
                  },
                ]),
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
