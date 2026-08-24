import { useCallback, useEffect, useRef, useState } from 'react'
import { useValue, useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { tabs$, type Tab } from '@/states/tabs'
import { queue$ } from '@/states/queue'
import { settings$ } from '@/states/settings'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { createLogger } from '@/lib/log'
import { EmbedVideoModal } from '@/components/modal/EmbedVideoModal'
import NouTubeViewModule, { NouTubeView } from '@/modules/nou-tube-view'
import { StyleSheet, View } from 'react-native'
import { getVideoId, setPageUrl } from '@/lib/page'
import { getLastPlaying } from '@/lib/last-playing'
import { normalizeUrl } from '@/lib/url'
import { showToast } from '@/lib/toast'
import { clsx, isAndroid, isWeb, nIf } from '@/lib/utils'
import type { WebviewTag } from 'electron'
import { NouHeader } from '../header/NouHeader'
import { WebviewContainer } from './webview-container'
import { syncSupabase } from '@/lib/supabase/sync'
import { auth$ } from '@/states/auth'
import { useMe } from '@/lib/hooks/useMe'
import { ObservableHint } from '@legendapp/state'
import { mainClient } from '@/lib/main-client'
import { onDownloadProgress } from '@/lib/download-progress'
import { describeDownloadError } from '@/lib/download-error'
import { t } from 'i18next'
import { downloads$ } from '@/states/downloads'
import { resolveUserAgent } from '@/lib/useragent'
import { handleShortcuts } from '@/desktop/src/renderer/lib/shortcuts'
import { openPastedUrl } from '@/lib/paste-url'
import { usePasteUrl } from '@/lib/hooks/usePasteUrl'
import { history$ } from '@/states/history'
import { buildUserScriptSources, userScriptsInvalidationSource } from '@/lib/user-styles'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
import { addSystemCaptionStyleListener, getSystemCaptionStyle } from '@/lib/system-captions'
import { addSystemDesktopModeListener, getSystemDesktopMode } from '@/lib/desktop-mode'
import { useDesktopMode } from '@/lib/hooks/useDesktopMode'
import { SettingsModal } from '../modal/SettingsModal'

let restored = false
const logger = createLogger('sync')

const onScroll = ({
  dy,
  y,
  autoHideHeader,
  hideToolbarWhenScrolled,
}: {
  dy?: number
  y?: number
  autoHideHeader: boolean
  hideToolbarWhenScrolled: boolean
}) => {
  if (hideToolbarWhenScrolled && typeof y === 'number') {
    ui$.headerShown.set(y <= 0)
    return
  }

  if (!autoHideHeader || typeof dy !== 'number') {
    return
  }

  const headerHeight = ui$.headerHeight.get()
  const headerShown = ui$.headerShown.get()
  if (Math.abs(dy) <= headerHeight / 2) {
    return
  }
  if (dy < 0 && headerShown) {
    ui$.headerShown.set(false)
  } else if (dy > 0 && !headerShown) {
    ui$.headerShown.set(true)
  }
}

function restoreLastPlaying(webview: any) {
  if (webview && settings$.restoreOnStart.get() && !restored) {
    restored = true
    webview.executeJavaScript('window.NouTube.restoreLastPlaying()')
  }
}

const YOUTUBE_HOSTS = ['m.youtube.com', 'music.youtube.com', 'www.youtube.com', 'youtube.com', 'youtu.be']

const executeQuietly = (webview: WebviewTag | null, script: string) => {
  try {
    void webview?.executeJavaScript(script).catch?.(() => undefined)
  } catch {}
}

const getContentSettingsSnapshot = () => {
  const {
    sponsorBlock,
    playbackRate,
    playbackQuality,
    miniPlayer,
    showDislikes,
    showOriginalVideoTitle,
    doubleTapToToggleHeader,
    translateComments,
    translationTargetLanguage,
    replaceWatchNavigation,
    useSystemCaptionStyle,
  } = settings$.get()
  return {
    sponsorBlock,
    playbackRate,
    playbackQuality,
    miniPlayer,
    showDislikes,
    showOriginalVideoTitle,
    doubleTapToToggleHeader,
    translateComments: !isWeb && translateComments && Boolean(translationTargetLanguage),
    replaceWatchNavigation,
    captionStyle: useSystemCaptionStyle ? getSystemCaptionStyle() : null,
  }
}

const DesktopTabView: React.FC<{
  tab: Tab
  index: number
  isActive: boolean
  contentJs: string
  userAgent: string
  onMessage: (type: string, data: any) => void
  buildPrelude: () => string
}> = ({ tab, index, isActive, contentJs, userAgent, onMessage, buildPrelude }) => {
  const webviewRef = useRef<WebviewTag>(null)
  const readyRef = useRef(false)
  const initialUrlRef = useRef(tab.pageUrl || tab.url)
  const lastRequestedUrlRef = useRef(tab.url)
  const hideShorts = useValue(settings$.hideShorts)
  const preferH264 = useValue(settings$.preferH264)
  const clickbaitThumbnail = useValue(settings$.clickbaitThumbnail)

  const syncUserStylesToWebview = useCallback(() => {
    if (!readyRef.current) return
    const snapshot = getUserStylesSnapshot()
    const value = JSON.stringify(snapshot)
    executeQuietly(webviewRef.current, `window.NouTube?.setUserStyles?.(${value})`)
    // Scripts enabled since the page loaded still need their first run; the
    // invalidation stands down anything still pending from the previous set,
    // and the in-page guard keeps what already ran from running twice.
    executeQuietly(webviewRef.current, userScriptsInvalidationSource)
    for (const source of buildUserScriptSources(snapshot)) {
      executeQuietly(webviewRef.current, source)
    }
  }, [])

  const syncBlocklistToWebview = useCallback(() => {
    if (!readyRef.current) return
    const snapshot = getBlocklistSnapshot()
    const value = JSON.stringify(snapshot)
    executeQuietly(webviewRef.current, `window.NouTube?.setBlocklist?.(${value})`)
    void mainClient.setBlocklist(snapshot)
  }, [])

  const syncSettingsToWebview = useCallback(() => {
    if (!readyRef.current) return
    const settings = getContentSettingsSnapshot()
    const value = JSON.stringify(settings)
    executeQuietly(
      webviewRef.current,
      `localStorage.setItem('nou:settings', '${value}'); window.NouTube?.setSettings?.(${value}); if (!${settings.miniPlayer}) window.NouTube?.exitMini?.()`,
    )
  }, [])

  const toggleShorts = useCallback((hide?: boolean) => {
    if (!readyRef.current) return
    executeQuietly(webviewRef.current, hide ? 'window.NouTube?.hideShorts?.()' : 'window.NouTube?.showShorts?.()')
  }, [])

  const refreshCanGoBack = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return
    try {
      const canGoBack = webview.canGoBack()
      tabs$.setTabCanGoBack(Boolean(canGoBack), index)
    } catch {}
  }, [index])

  useEffect(() => {
    if (!isActive || !webviewRef.current) {
      return
    }
    ui$.webview.set(ObservableHint.opaque(webviewRef.current))
    ui$.pageUrl.set(tab.pageUrl || tab.url)
    refreshCanGoBack()
  }, [isActive, refreshCanGoBack, tab.pageUrl, tab.url])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview || !tab.url) {
      return
    }
    if (lastRequestedUrlRef.current === tab.url) {
      return
    }
    lastRequestedUrlRef.current = tab.url
    try {
      if (webview.getURL() === tab.url) {
        return
      }
    } catch {}
    webview.src = tab.url
  }, [tab.url])

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }

    const onDomReady = () => {
      readyRef.current = true
      if (isActive) {
        ui$.webview.set(ObservableHint.opaque(webview))
      }
      // Bridged on the webview we just injected into, so background tabs get
      // the keyboard and paste listeners too.
      executeQuietly(
        webview,
        `window.isAndroid = false;\n${buildPrelude()}\n${contentJs}\n;window.NouTube?.bridgeShortcuts?.()`,
      )
      // One call per script: a malformed script must not take the others, or
      // the content bundle above, down with it.
      for (const source of buildUserScriptSources(getUserStylesSnapshot())) {
        executeQuietly(webview, source)
      }
      toggleShorts(hideShorts)
      syncUserStylesToWebview()
      syncBlocklistToWebview()
      syncSettingsToWebview()
      refreshCanGoBack()
    }
    const onStartLoading = () => tabs$.setTabLoading(true, index)
    const onStopLoading = () => tabs$.setTabLoading(false, index)
    const onNavigate = (e: { url: string }) => {
      try {
        const { host } = new URL(e.url)
        void mainClient.toggleInterception(YOUTUBE_HOSTS.includes(host))
        tabs$.setTabPageUrl(e.url, index)
        if (isActive) {
          ui$.pageUrl.set(e.url)
        }
      } catch {
        tabs$.setTabPageUrl(e.url, index)
      }
      refreshCanGoBack()
    }
    const onIpcMessage = (e: { channel: string; args: any[] }) => onMessage(e.channel, e.args[0])
    const onFavicon = (e: { favicons: string[] }) => {
      tabs$.setTabMeta({ title: webview.getTitle(), icon: e.favicons.at(-1) }, index)
    }
    const onTitle = (e: { title: string }) => {
      tabs$.setTabMeta({ title: e.title || webview.getTitle() }, index)
    }
    const onInput = ((e: Electron.Event & { input: Electron.Input }) => {
      if (e.input.type === 'keyDown') {
        handleShortcuts(e.input)
      }
    }) as unknown as (e: Event) => void

    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-start-loading', onStartLoading)
    webview.addEventListener('did-stop-loading', onStopLoading)
    webview.addEventListener('did-finish-load', onStopLoading)
    webview.addEventListener('did-fail-load', onStopLoading)
    webview.addEventListener('did-fail-provisional-load', onStopLoading)
    webview.addEventListener('did-navigate', onNavigate)
    webview.addEventListener('did-navigate-in-page', onNavigate)
    webview.addEventListener('ipc-message', onIpcMessage)
    webview.addEventListener('page-favicon-updated', onFavicon)
    webview.addEventListener('page-title-updated', onTitle)
    webview.addEventListener('before-input-event', onInput)

    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-start-loading', onStartLoading)
      webview.removeEventListener('did-stop-loading', onStopLoading)
      webview.removeEventListener('did-finish-load', onStopLoading)
      webview.removeEventListener('did-fail-load', onStopLoading)
      webview.removeEventListener('did-fail-provisional-load', onStopLoading)
      webview.removeEventListener('did-navigate', onNavigate)
      webview.removeEventListener('did-navigate-in-page', onNavigate)
      webview.removeEventListener('ipc-message', onIpcMessage)
      webview.removeEventListener('page-favicon-updated', onFavicon)
      webview.removeEventListener('page-title-updated', onTitle)
      webview.removeEventListener('before-input-event', onInput)
    }
  }, [
    buildPrelude,
    contentJs,
    hideShorts,
    index,
    isActive,
    onMessage,
    refreshCanGoBack,
    syncBlocklistToWebview,
    syncSettingsToWebview,
    syncUserStylesToWebview,
    toggleShorts,
  ])

  useObserveEffect(settings$.hideShorts, ({ value }) => toggleShorts(value))
  useObserveEffect(settings$.sponsorBlock, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackRate, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackQuality, () => syncSettingsToWebview())
  useObserveEffect(settings$.miniPlayer, () => syncSettingsToWebview())
  useObserveEffect(settings$.showDislikes, () => syncSettingsToWebview())
  useObserveEffect(settings$.showOriginalVideoTitle, () => syncSettingsToWebview())
  useObserveEffect(settings$.doubleTapToToggleHeader, () => syncSettingsToWebview())
  useObserveEffect(userStyles$, () => syncUserStylesToWebview())
  useObserveEffect(blocklist$, () => syncBlocklistToWebview())
  useEffect(() => {
    if (!readyRef.current) return
    executeQuietly(
      webviewRef.current,
      `window.NouTubePreferH264 = ${preferH264 ? 'true' : 'false'}; window.NouTubeClickbaitThumbnail = ${JSON.stringify(clickbaitThumbnail)}; document.location.reload()`,
    )
  }, [clickbaitThumbnail, preferH264])

  return (
    <View
      pointerEvents={isActive ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { opacity: isActive ? 1 : 0, zIndex: isActive ? 1 : 0 }]}
    >
      <NouTubeView
        ref={webviewRef}
        style={{ flex: 1 }}
        src={initialUrlRef.current}
        useragent={userAgent}
        partition="persist:webview"
        allowpopups="true"
      />
    </View>
  )
}

export const MainPageContent: React.FC<{ contentJs: string }> = ({ contentJs }) => {
  const pageUrl = useValue(ui$.pageUrl)
  const embedVideoId = useValue(ui$.embedVideoId)
  usePasteUrl()
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activePageUrl = useValue(tabs$.activePageUrl)
  const nativeRef = useRef<typeof NouTubeViewModule>(null)
  const hideShorts = useValue(settings$.hideShorts)
  const isYTMusic = useValue(settings$.isYTMusic)
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const doubleTapToToggleHeader = useValue(settings$.doubleTapToToggleHeader)
  const translateComments = useValue(settings$.translateComments)
  const translationTargetLanguage = useValue(settings$.translationTargetLanguage)
  const headerPosition = useValue(settings$.headerPosition)
  const headerHeight = useValue(ui$.headerHeight)
  const headerShown = useValue(ui$.headerShown)
  const pullToRefreshEnabled = useValue(settings$.pullToRefreshEnabled)
  const defaultZoom = useValue(settings$.defaultZoom)
  const customUserAgent = useValue(settings$.userAgent)
  // Seeded before the first render reads it, so a start on an external display
  // mounts the webview with the desktop user agent instead of loading the
  // mobile site and reloading right after.
  const seededSystemDesktopMode = useRef(false)
  if (!seededSystemDesktopMode.current) {
    seededSystemDesktopMode.current = true
    ui$.systemDesktopMode.set(getSystemDesktopMode())
  }
  const desktopMode = useDesktopMode(isYTMusic)
  const preferH264 = useValue(settings$.preferH264)
  const clickbaitThumbnail = useValue(settings$.clickbaitThumbnail)
  const blocklistState = useValue(blocklist$)
  const [blocklistSynced, setBlocklistSynced] = useState(!isWeb)
  const buildPrelude = () =>
    `window.NouTubeInitialSettings = ${JSON.stringify(getContentSettingsSnapshot())};` +
    `window.NouTubePreferH264 = ${settings$.preferH264.get() ? 'true' : 'false'};` +
    `window.NouTubeClickbaitThumbnail = ${JSON.stringify(settings$.clickbaitThumbnail.get())};` +
    `window.NouTubeUserStyles = ${JSON.stringify(getUserStylesSnapshot())};` +
    `window.NouTubeBlocklist = ${JSON.stringify(getBlocklistSnapshot())};`
  const contentSettings = getContentSettingsSnapshot()
  // Subscribed so a saved or toggled script reaches the next document start.
  const userStylesState = useValue(userStyles$)
  const userScriptsOnStart = buildUserScriptSources(getUserStylesSnapshot(userStylesState))
  const preludeJs =
    `window.NouTubeInitialSettings = ${JSON.stringify(contentSettings)};` +
    `window.NouTubePreferH264 = ${preferH264 ? 'true' : 'false'};` +
    `window.NouTubeClickbaitThumbnail = ${JSON.stringify(clickbaitThumbnail)};` +
    `window.NouTubeUserStyles = ${JSON.stringify(getUserStylesSnapshot())};` +
    `window.NouTubeBlocklist = ${JSON.stringify(getBlocklistSnapshot(blocklistState))};`
  const { userId, me } = useMe()
  const userAgent = resolveUserAgent(isWeb ? window.electron.process.platform : 'android', customUserAgent, desktopMode)
  const getNoutube = useCallback(() => ui$.webview.get() || nativeRef.current, [])
  const nativeDoubleTapHeader = isAndroid && doubleTapToToggleHeader
  // Native has no vertical sidebar layout, so the toolbar overlays the page in
  // portrait and landscape alike.
  const nativeHeaderOverlays = !isWeb && (autoHideHeader || hideToolbarWhenScrolled || nativeDoubleTapHeader)
  const nativeHeaderInset = nativeHeaderOverlays && headerShown ? headerHeight : 0

  useEffect(() => {
    if (isWeb) {
      // The main process filters the server-rendered ytInitialData, so it needs
      // the blocklist before any webview starts navigating.
      void mainClient
        .setBlocklist(getBlocklistSnapshot())
        .catch(() => undefined)
        .then(() => setBlocklistSynced(true))
    }

    // Background yt-dlp update every 2 weeks
    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000
    const now = Date.now()
    const lastUpdate = settings$.lastYtDlpUpdate.get()
    if (now - lastUpdate > TWO_WEEKS) {
      mainClient.updateYtDlp().then(() => {
        settings$.lastYtDlpUpdate.set(now)
      })
    }

    return onDownloadProgress((payload) => {
      const current = downloads$[payload.url].get()
      if (!current) return

      if (payload.line) downloads$[payload.url].progressLine.set(payload.line)
      if (typeof payload.progress === 'number') downloads$[payload.url].progress.set(payload.progress)
      if (payload.done) {
        if (payload.error) {
          console.error('download error', payload)
          const { messageKey, detail } = describeDownloadError(payload.line || '')
          downloads$[payload.url].assign({
            phase: 'error',
            errorMsg: messageKey ? t(messageKey) : detail || t('modals.downloadFailed'),
          })
        } else {
          downloads$[payload.url].assign({
            progress: 100,
            savedPath: payload.filePath || '',
            phase: 'done',
          })
        }
      }
    })
  }, [])

  const toggleShorts = useCallback(
    (hide?: boolean) => {
      const ref = nativeRef.current
      ref?.executeJavaScript(hide ? 'NouTube.hideShorts()' : 'NouTube.showShorts()')
    },
    [nativeRef],
  )

  const syncUserStylesToWebview = useCallback(() => {
    const ref = nativeRef.current
    const snapshot = getUserStylesSnapshot()
    const value = JSON.stringify(snapshot)
    ref?.executeJavaScript(`window.NouTube.setUserStyles(${value})`)
    ref?.executeJavaScript(userScriptsInvalidationSource)
    for (const source of buildUserScriptSources(snapshot)) {
      ref?.executeJavaScript(source)
    }
  }, [nativeRef])

  const syncBlocklistToWebview = useCallback(() => {
    const ref = nativeRef.current
    const snapshot = getBlocklistSnapshot()
    const value = JSON.stringify(snapshot)
    ref?.executeJavaScript(`window.NouTube?.setBlocklist?.(${value})`)
    if (isWeb) {
      void mainClient.setBlocklist(snapshot)
    }
  }, [nativeRef])

  const syncSettingsToWebview = useCallback(() => {
    const ref = nativeRef.current
    const settings = getContentSettingsSnapshot()
    const value = JSON.stringify(settings)
    ref?.executeJavaScript(
      `localStorage.setItem('nou:settings', '${value}'); window.NouTube?.setSettings?.(${value}); if (!${settings.miniPlayer}) window.NouTube?.exitMini?.()`,
    )
  }, [nativeRef])

  useEffect(() => {
    if (isWeb || ui$.url.get()) {
      return
    }
    // Start straight on the last playing video with its position in the url:
    // loading home first and letting the page restore itself loads twice, the
    // first time from 0.
    const lastPlaying = settings$.restoreOnStart.get() ? getLastPlaying() : undefined
    if (lastPlaying) {
      restored = true
      ui$.url.set(normalizeUrl(lastPlaying.url))
      return
    }
    ui$.url.set(isYTMusic ? 'https://music.youtube.com' : 'https://m.youtube.com')
  }, [])

  useEffect(() => {
    auth$.plan.set(me?.plan)
    const runSync = () => {
      void syncSupabase().catch((error) => {
        logger.error('syncSupabase failed', error)
      })
    }

    if (userId && me?.plan && me.plan !== 'free') {
      runSync()
      const timer = setInterval(
        () => runSync(),
        5 * 60 * 1000, // 5 minutes
      )
      return () => clearInterval(timer)
    }
  }, [me?.plan, userId])

  const onMessage = useCallback(
    async (type: string, data: any) => {
      switch (type) {
        case '[content]':
        case '[kotlin]':
        case 'log':
          console.log(type, data)
          if (data.msg === 'YoutubeDL initialized successfully') {
            showToast(data.msg)
          } else if (typeof data.msg === 'string' && data.msg.startsWith('YoutubeDL initialization failed')) {
            showToast(data.msg)
          }
          break
        case 'scroll':
          onScroll({ dy: data.dy, y: data.y, autoHideHeader, hideToolbarWhenScrolled })
          break
        case 'header-double-tap':
          if (isAndroid && doubleTapToToggleHeader) {
            ui$.headerShown.set(!ui$.headerShown.get())
          }
          break
        case 'translate-block':
          if (!isWeb && translateComments && translationTargetLanguage && typeof data?.text === 'string') {
            ui$.translation.set({
              id: String(data.id || Date.now()),
              text: data.text,
              targetLanguage: translationTargetLanguage,
              x: Number(data.x) || 16,
              y: Number(data.y) || 96,
            })
          }
          break
        case 'onload':
          const webview = ui$.webview.get() || nativeRef.current
          if (!isWeb) {
            // Desktop restores the last playing video through the tab url, so
            // this fallback is only for Android (and only fires when the
            // startup url above could not resolve the position).
            restoreLastPlaying(webview)
            toggleShorts(hideShorts)
            syncUserStylesToWebview()
            syncBlocklistToWebview()
            syncSettingsToWebview()
          }
          break
        case 'add-queue':
          queue$.addBookmark(data)
          showToast(`Added to queue`)
          break
        case 'star':
          bookmarks$.addBookmark(newBookmark(data))
          showToast(`Saved to bookmarks`)
          break
        case 'progress':
          history$.addHistory({
            videoId: data.videoId,
            url: data.url,
            title: data.title,
            current: data.current,
            duration: data.duration,
          })
          break
        case 'playback-rate':
          if (typeof data?.playbackRate == 'number' && Number.isFinite(data.playbackRate)) {
            settings$.playbackRate.set(data.playbackRate)
          }
          break
        case 'playback-quality':
          if (typeof data?.playbackQuality == 'string') {
            settings$.playbackQuality.set(data.playbackQuality)
          }
          break
        case 'playback-end':
          const currentPageUrl = isWeb ? activePageUrl : pageUrl
          const videoId = getVideoId(currentPageUrl)
          const bookmarks = queue$.bookmarks.get()
          const hasPlaylistParam = currentPageUrl.includes('list=')
          if (videoId && bookmarks.length && !hasPlaylistParam) {
            const queueIndex = bookmarks.findIndex((x) => getVideoId(x.url) == videoId)
            if (queueIndex != bookmarks.length - 1) {
              if (isWeb) {
                tabs$.updateTabUrl(bookmarks[queueIndex + 1].url)
              } else {
                ui$.url.set(bookmarks[queueIndex + 1].url)
              }
            }
          }
          break
        case 'embed':
          ui$.embedVideoId.set(data)
          break
        case 'download':
          ui$.toolsModalUrl.set(data.url)
          ui$.toolsModalOpen.set(true)
          break
        case 'keyup':
          handleShortcuts(data)
          break
        case 'paste':
          openPastedUrl(data)
          break
        case 'yt-music-desktop':
          if (settings$.desktopMode.get()) break
          settings$.desktopMode.set(true)
          if (isWeb) {
            tabs$.updateTabUrl('https://music.youtube.com')
          } else {
            ui$.url.set('https://music.youtube.com')
          }
          break
      }
    },
    [
      autoHideHeader,
      doubleTapToToggleHeader,
      translateComments,
      translationTargetLanguage,
      hideShorts,
      hideToolbarWhenScrolled,
      syncSettingsToWebview,
      syncBlocklistToWebview,
      syncUserStylesToWebview,
      toggleShorts,
      activePageUrl,
      pageUrl,
    ],
  )

  const onNativeMessage = async (e: { nativeEvent: { payload: string } }) => {
    const { payload } = e.nativeEvent
    const { type, data } = typeof payload == 'string' ? JSON.parse(payload) : payload
    onMessage(type, data)
  }

  useEffect(() => {
    if (settings$.hideMixPlaylist.get() && !userStyles$.builtins['hide-mix-playlist'].enabled.get()) {
      userStyles$.setBuiltinEnabled('hide-mix-playlist', true)
    }
    if (settings$.hideShortsInNavbar.get() && !userStyles$.builtins['hide-shorts-navbar'].enabled.get()) {
      userStyles$.setBuiltinEnabled('hide-shorts-navbar', true)
    }
  }, [])

  useEffect(() => {
    const webview = nativeRef.current
    if (webview) {
      ui$.webview.set(ObservableHint.opaque(webview))
      const url = ui$.url.get()
      ;(async () => {
        try {
          const location = await webview.executeJavaScript('document.location.href')
          if (location == 'about:blank') {
            webview.loadUrl(url)
          }
        } catch (e) {
          webview.loadUrl(url)
        }
      })()
    }
  }, [nativeRef])

  useObserveEffect(ui$.url, ({ value }) => {
    const native = nativeRef.current
    if (isWeb) {
      return
    }
    try {
      if (value && new URL(value).pathname != '/' && !restored) {
        restored = true
      }
    } catch (e) {}
    if (value) {
      if (native) {
        native.loadUrl(value)
      }
    }
  })

  useObserveEffect(settings$.hideShorts, ({ value }) => toggleShorts(value))
  useObserveEffect(settings$.sponsorBlock, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackRate, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackQuality, () => syncSettingsToWebview())
  useObserveEffect(settings$.miniPlayer, () => syncSettingsToWebview())
  useObserveEffect(settings$.showDislikes, () => syncSettingsToWebview())
  useObserveEffect(settings$.showOriginalVideoTitle, () => syncSettingsToWebview())
  useObserveEffect(settings$.doubleTapToToggleHeader, () => syncSettingsToWebview())
  useObserveEffect(settings$.translateComments, () => syncSettingsToWebview())
  useObserveEffect(settings$.translationTargetLanguage, () => syncSettingsToWebview())
  useObserveEffect(settings$.useSystemCaptionStyle, () => syncSettingsToWebview())

  // Track whether Android runs us on a desktop-class screen. The manual
  // desktop-site override only lasts for one such session, so drop it whenever
  // the mode flips.
  useEffect(() => {
    const apply = (systemDesktopMode: boolean) => {
      if (ui$.systemDesktopMode.get() == systemDesktopMode) {
        return
      }
      ui$.systemDesktopMode.set(systemDesktopMode)
      ui$.desktopModeOverride.set(undefined)
    }
    const subscription = addSystemDesktopModeListener(apply)
    // Subscribe first, then re-read: the native side only emits on a change, so
    // a display swap between the seed above and this line would otherwise leave
    // JS on the stale mode until the next real transition.
    apply(getSystemDesktopMode())
    return () => subscription?.remove?.()
  }, [])

  // The webview applies a new user agent on the next load, so every change to
  // it -- desktop mode, the desktop-site toggle, a custom agent -- needs a
  // reload once the prop has been handed over.
  const previousUserAgentRef = useRef(userAgent)
  useEffect(() => {
    if (previousUserAgentRef.current == userAgent) {
      return
    }
    previousUserAgentRef.current = userAgent
    // Fire and forget: the native call rejects if the view is between mounts,
    // and the fresh view loads with the new agent anyway.
    try {
      void getNoutube()
        ?.executeJavaScript?.('document.location.reload()')
        ?.catch?.(() => undefined)
    } catch {}
  }, [userAgent, getNoutube])

  // Changing the preferences in Android Settings has to reach the open webview
  // without a reload.
  useEffect(() => {
    const subscription = addSystemCaptionStyleListener(() => {
      if (settings$.useSystemCaptionStyle.get()) {
        syncSettingsToWebview()
      }
    })
    return () => subscription?.remove?.()
  }, [syncSettingsToWebview])

  useObserveEffect(settings$.preferH264, ({ previous }) => {
    if (previous === undefined) return
    const native = nativeRef.current
    if (native) {
      native.executeJavaScript('document.location.reload()')
    }
  })
  useObserveEffect(settings$.clickbaitThumbnail, ({ previous }) => {
    if (previous === undefined) return
    const native = nativeRef.current
    if (native) {
      native.executeJavaScript('document.location.reload()')
    }
  })
  useObserveEffect(userStyles$, () => syncUserStylesToWebview())
  useObserveEffect(blocklist$, () => syncBlocklistToWebview())

  const syncProxyToSession = useCallback(() => {
    if (!isWeb) return
    const settings = settings$.get()
    void mainClient.setProxy({
      enabled: settings.proxyEnabled,
      type: settings.proxyType,
      host: settings.proxyHost,
      port: settings.proxyPort,
    })
  }, [])

  useEffect(() => {
    syncProxyToSession()
  }, [syncProxyToSession])

  useObserveEffect(settings$.proxyEnabled, ({ previous }) => {
    if (previous === undefined) return
    syncProxyToSession()
  })
  useObserveEffect(settings$.proxyType, ({ previous }) => {
    if (previous === undefined) return
    syncProxyToSession()
  })
  useObserveEffect(settings$.proxyHost, ({ previous }) => {
    if (previous === undefined) return
    syncProxyToSession()
  })
  useObserveEffect(settings$.proxyPort, ({ previous }) => {
    if (previous === undefined) return
    syncProxyToSession()
  })

  const onLoad = async (e: { nativeEvent: any }) => {
    ui$.translation.set(null)
    setPageUrl(e.nativeEvent.url)
  }

  return (
    <>
      <View
        className={clsx(
          'flex-1 h-full overflow-hidden',
          isWeb && 'lg:flex-row',
          headerPosition === 'bottom' && 'flex-col-reverse',
        )}
      >
        <NouHeader getNoutube={getNoutube} />
        {nIf(isWeb, <SettingsModal />)}
        {isWeb ? (
          <View className="relative flex-1 min-h-0">
            {(blocklistSynced ? tabs : []).map((tab, index) => (
              <DesktopTabView
                key={tab.id}
                tab={tab}
                index={index}
                isActive={index === activeTabIndex}
                contentJs={contentJs}
                userAgent={userAgent}
                onMessage={onMessage}
                buildPrelude={buildPrelude}
              />
            ))}
          </View>
        ) : (
          <WebviewContainer headerPosition={headerPosition} nativeHeaderInset={nativeHeaderInset}>
            <NouTubeView
              ref={nativeRef}
              style={{
                flex: 1,
              }}
              useragent={userAgent}
              pullToRefreshEnabled={pullToRefreshEnabled}
              textZoom={defaultZoom}
              scriptOnStart={`window.isAndroid = true;\n${preludeJs}\n${contentJs}`}
              userScriptsOnStart={userScriptsOnStart}
              onLoad={onLoad}
              onMessage={onNativeMessage}
            />
          </WebviewContainer>
        )}
        {nIf(
          embedVideoId,
          <EmbedVideoModal
            videoId={embedVideoId}
            scriptOnStart={`${isWeb ? 'window.isAndroid = false;' : 'window.isAndroid = true;'}\n${preludeJs}\n${contentJs}`}
            // Only the native view injects these; on web the props land on a
            // <webview> element as attributes.
            userScriptsOnStart={isWeb ? undefined : userScriptsOnStart}
            onClose={() => ui$.embedVideoId.set('')}
          />,
        )}
      </View>
    </>
  )
}
