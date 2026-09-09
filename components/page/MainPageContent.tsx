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
import { setPageUrl } from '@/lib/page'
import { getNextQueueUrl, trackQueueEnded, trackQueuePlaying } from '@/lib/queue'
import { getLastPlaying } from '@/lib/last-playing'
import { normalizeUrl } from '@/lib/url'
import { showToast } from '@/lib/toast'
import { clsx, isAndroid, isWeb, nIf } from '@/lib/utils'
import type { WebviewTag } from 'electron'
import { NouHeader } from '../header/NouHeader'
import { WebviewContainer } from './webview-container'
import { PageLoadError } from './PageLoadError'
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
import { retryNativeViewCall } from '@/lib/native-view-call'
import { openPastedUrl } from '@/lib/paste-url'
import { usePasteUrl } from '@/lib/hooks/usePasteUrl'
import { history$ } from '@/states/history'
import { buildUserScriptSources, userScriptsInvalidationSource } from '@/lib/user-styles'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
import { addSystemCaptionStyleListener, getSystemCaptionStyle } from '@/lib/system-captions'
import { addSystemDesktopModeListener, getSystemDesktopMode } from '@/lib/desktop-mode'
import { addPictureInPictureListener } from '@/lib/picture-in-picture'
import { useDesktopMode } from '@/lib/hooks/useDesktopMode'
import { SettingsModal } from '../modal/SettingsModal'
import { PlayerFrame } from './PlayerFrame'
import {
  closePlayer,
  isSplitWatchEnabled,
  isWatchUrl,
  openInPlayer,
  openInBrowse,
  reapplyPlayerMode,
  setBrowseWebview,
  setPlayerWebview,
  setSplitPageUrl,
  syncBrowseMute,
  syncForegroundWebview,
} from '@/lib/split-view'

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

/* Tells the page which half of the split watch view it is, so it can hand over
 * the links the other half owns (see content/split-view.ts). */
const splitRolePrelude = (enabled: boolean, role: 'browse' | 'player', mini = false) =>
  enabled ? `window.NouTubeRole = ${JSON.stringify(role)};window.NouTubeNativeMini = ${mini};` : ''

const getContentSettingsSnapshot = () => {
  const {
    sponsorBlock,
    blockAds,
    playbackRate,
    playbackQuality,
    miniPlayer,
    pictureInPicture,
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
    blockAds,
    playbackRate,
    playbackQuality,
    miniPlayer,
    pictureInPicture,
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
      `localStorage.setItem('nou:settings', '${value}'); window.NouTube?.setSettings?.(${value})`,
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
  useObserveEffect(settings$.blockAds, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackRate, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackQuality, () => syncSettingsToWebview())
  useObserveEffect(settings$.miniPlayer, () => syncSettingsToWebview())
  useObserveEffect(settings$.pictureInPicture, () => syncSettingsToWebview())
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
  const currentPageUrl = isWeb ? activePageUrl : pageUrl
  const nativeRef = useRef<typeof NouTubeViewModule>(null)
  const playerRef = useRef<typeof NouTubeViewModule>(null)
  const splitWatchView = useValue(settings$.miniPlayer) && isAndroid
  const playerUrl = useValue(ui$.playerUrl)
  const playerMode = useValue(ui$.playerMode)
  const playerFull = playerMode === 'full'
  const playerMini = playerMode === 'mini'
  const [playerPlaying, setPlayerPlaying] = useState(false)
  const playerPageUrl = useValue(ui$.playerPageUrl)
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
  const pictureInPicture = useValue(ui$.pictureInPicture)
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
  // Set once the native view gives up retrying a failed navigation (#339).
  // Kept per webview: an error belongs to the page that raised it, and showing
  // the browsing one's over the player -- or the other way round -- would cover
  // a page that loaded perfectly well.
  type LoadError = { url: string; description?: string; canReload: boolean }
  const [loadErrors, setLoadErrors] = useState<{ browse: LoadError | null; player: LoadError | null }>({
    browse: null,
    player: null,
  })
  const setLoadError = useCallback(
    (view: 'browse' | 'player', error: LoadError | null) =>
      setLoadErrors((current) => (current[view] === error ? current : { ...current, [view]: error })),
    [],
  )
  const loadError = (splitWatchView && playerFull ? loadErrors.player : loadErrors.browse) ?? null
  const buildPrelude = () =>
    `window.NouTubeInitialSettings = ${JSON.stringify(getContentSettingsSnapshot())};` +
    `window.NouTubePreferH264 = ${settings$.preferH264.get() ? 'true' : 'false'};` +
    `window.NouTubeClickbaitThumbnail = ${JSON.stringify(settings$.clickbaitThumbnail.get())};` +
    `window.NouTubeUserStyles = ${JSON.stringify(getUserStylesSnapshot())};` +
    `window.NouTubeBlocklist = ${JSON.stringify(getBlocklistSnapshot())};`
  // Subscribed so the next document starts with the current preference: the
  // prelude decides what the in-page interceptor strips before the page renders,
  // and the post-load sync cannot bring back data stripped on the way in.
  const blockAds = useValue(settings$.blockAds)
  const contentSettings = { ...getContentSettingsSnapshot(), blockAds }
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
  const nativeHeaderInset = nativeHeaderOverlays && headerShown && !pictureInPicture ? headerHeight : 0

  useEffect(() => {
    if (isWeb) {
      // The main process filters the server-rendered ytInitialData, so it needs
      // the blocklist and the ad blocking preference before any webview starts
      // navigating.
      void Promise.all([
        mainClient.setBlocklist(getBlocklistSnapshot()),
        mainClient.setBlockAds(settings$.blockAds.peek()),
      ])
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

  // Both native webviews are live at once in the split watch view, so every
  // setting has to reach the player as well as the browsing page.
  const nativeViews = useCallback(() => [nativeRef.current, playerRef.current].filter(Boolean) as any[], [])

  const toggleShorts = useCallback(
    (hide?: boolean) => {
      for (const ref of nativeViews()) {
        ref.executeJavaScript(hide ? 'NouTube.hideShorts()' : 'NouTube.showShorts()')
      }
    },
    [nativeViews],
  )

  const syncUserStylesToWebview = useCallback(() => {
    const snapshot = getUserStylesSnapshot()
    const value = JSON.stringify(snapshot)
    for (const ref of nativeViews()) {
      ref.executeJavaScript(`window.NouTube.setUserStyles(${value})`)
      ref.executeJavaScript(userScriptsInvalidationSource)
      for (const source of buildUserScriptSources(snapshot)) {
        ref.executeJavaScript(source)
      }
    }
  }, [nativeViews])

  const syncBlocklistToWebview = useCallback(() => {
    const snapshot = getBlocklistSnapshot()
    const value = JSON.stringify(snapshot)
    for (const ref of nativeViews()) {
      ref.executeJavaScript(`window.NouTube?.setBlocklist?.(${value})`)
    }
    if (isWeb) {
      void mainClient.setBlocklist(snapshot)
    }
  }, [nativeViews])

  const syncSettingsToWebview = useCallback(() => {
    const settings = getContentSettingsSnapshot()
    const value = JSON.stringify(settings)
    for (const ref of nativeViews()) {
      ref.executeJavaScript(
        `localStorage.setItem('nou:settings', '${value}'); window.NouTube?.setSettings?.(${value})`,
      )
    }
    if (isWeb) {
      // Electron strips ads in the main process rather than in the page (see
      // content/main.ts), so the preference has to reach it as well; it applies
      // from the next request on.
      void mainClient.setBlockAds(settings.blockAds)
    }
  }, [nativeViews])

  // The url observer below fires once as it mounts. When the restore above put
  // the video straight into the player, that first fire is the browsing page's
  // own url and would send it back to the front, hiding the restored video.
  const skipFirstUrlObserve = useRef(false)

  useEffect(() => {
    if (isWeb || ui$.url.get()) {
      return
    }
    // Start straight on the last playing video with its position in the url:
    // loading home first and letting the page restore itself loads twice, the
    // first time from 0.
    const lastPlaying = settings$.restoreOnStart.get() ? getLastPlaying() : undefined
    const home = isYTMusic ? 'https://music.youtube.com' : 'https://m.youtube.com'
    if (lastPlaying) {
      restored = true
      const url = normalizeUrl(lastPlaying.url)
      // In the split view the restored video belongs to the player, and the
      // browsing webview still needs a page of its own to come back to.
      if (isSplitWatchEnabled() && isWatchUrl(url)) {
        skipFirstUrlObserve.current = true
        ui$.url.set(home)
        openInPlayer(url)
        return
      }
      ui$.url.set(url)
      return
    }
    ui$.url.set(home)
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
    async (type: string, data: any, source: 'browse' | 'player' = 'browse') => {
      // The hidden webview keeps running; its chrome events would fight the
      // page the user is actually looking at.
      const isForeground =
        !splitWatchView || source === (ui$.playerMode.get() === 'full' ? 'player' : 'browse')
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
          if (!isForeground) break
          onScroll({ dy: data.dy, y: data.y, autoHideHeader, hideToolbarWhenScrolled })
          break
        case 'header-double-tap':
          if (!isForeground) break
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
        case 'open-watch':
          // A video link tapped in the browsing webview: the player takes it.
          if (isSplitWatchEnabled() && typeof data?.url === 'string' && isWatchUrl(data.url)) {
            openInPlayer(data.url)
          }
          break
        case 'open-page':
          // A link out of the video -- a channel, a playlist, search. The
          // browsing webview takes over and the player keeps playing behind it.
          if (typeof data?.url === 'string' && data.url) {
            openInBrowse(data.url)
          }
          break
        case 'onload':
          const webview = (source === 'player' ? playerRef.current : nativeRef.current) || ui$.webview.get()
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
        case 'play-state':
          if (source === 'player') {
            setPlayerPlaying(Boolean(data?.playing))
          }
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
          const endedUrl = source === 'player' ? ui$.playerPageUrl.get() || currentPageUrl : currentPageUrl
          const hasPlaylistParam = endedUrl.includes('list=')
          if (!hasPlaylistParam) {
            trackQueueEnded(endedUrl)
            const nextUrl = getNextQueueUrl(endedUrl)
            if (nextUrl) {
              if (isWeb) {
                tabs$.updateTabUrl(nextUrl)
              } else if (splitWatchView && isWatchUrl(nextUrl)) {
                // Advancing on its own must not throw the video back at the
                // user: whatever the player was, it stays.
                openInPlayer(nextUrl, { keepMode: source === 'player' })
              } else {
                ui$.url.set(nextUrl)
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
        case 'load-error':
          // Recorded against the webview that raised it rather than dropped
          // when it is out of sight, so it is there if the user comes back to
          // that view -- only the foreground one is rendered.
          setLoadError(source, {
            url: data?.url || '',
            description: data?.description,
            canReload: data?.canReload !== false,
          })
          break
        case 'load-error-cleared':
          setLoadError(source, null)
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
      currentPageUrl,
      splitWatchView,
    ],
  )

  const onNativeMessage = async (e: { nativeEvent: { payload: string } }) => {
    const { payload } = e.nativeEvent
    const { type, data } = typeof payload == 'string' ? JSON.parse(payload) : payload
    onMessage(type, data, 'browse')
  }

  const onPlayerMessage = async (e: { nativeEvent: { payload: string } }) => {
    const { payload } = e.nativeEvent
    const { type, data } = typeof payload == 'string' ? JSON.parse(payload) : payload
    onMessage(type, data, 'player')
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
      setBrowseWebview(webview)
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
    if (isWeb || !value) {
      return
    }
    if (skipFirstUrlObserve.current) {
      skipFirstUrlObserve.current = false
      return
    }
    try {
      if (new URL(value).pathname != '/' && !restored) {
        restored = true
      }
    } catch (e) {}
    if (isSplitWatchEnabled() && isWatchUrl(value)) {
      openInPlayer(value)
      return
    }
    if (isSplitWatchEnabled()) {
      // Anything that is not a video belongs to the browsing webview, so it
      // comes back to the front -- the player keeps playing behind it.
      openInBrowse(value)
      return
    }
    nativeRef.current?.loadUrl(value)
  })

  // The player webview is mounted for the whole session once the split is on,
  // not created on the first video: building a WebView and its renderer is a
  // visible chunk of how long that first video takes to appear. It sits at
  // about:blank until there is something to play. Registering it hands over any
  // video that was asked for before it attached.
  useEffect(() => {
    if (isWeb) {
      return
    }
    // Only registered here. Turning the split off has to tear the video down
    // first, and that runs in the effect below -- clearing the reference now
    // would leave it with nothing to pause or empty, and a video playing on
    // with no way to reach it.
    if (!splitWatchView) {
      return
    }
    setPlayerWebview(playerRef.current)
  }, [splitWatchView])

  // Two webviews, one media session: whichever view holds the video owns the
  // notification and the system media controls (see NouService.initialize).
  useEffect(() => {
    if (isWeb) {
      return
    }
    const owner = playerUrl ? playerRef.current : nativeRef.current
    if (owner) {
      // Retried while the view comes up: turning the split on while a video is
      // open mounts the player webview and claims for it in the same commit,
      // and a claim that lands before the native view exists leaves the
      // notification and the system media controls on the browsing webview.
      retryNativeViewCall(
        () => owner.claimMediaSession?.(),
        () => (ui$.playerUrl.get() ? playerRef.current : nativeRef.current) !== owner,
      )
    }
    syncBrowseMute()
  }, [playerUrl])

  useEffect(() => {
    syncForegroundWebview()
  }, [playerMode])

  // The player's error belongs to the video that failed. A new one starting --
  // or the player being torn down, which destroys the webview that raised it --
  // leaves nothing to clear it: the replacement view starts out with no error
  // to report cleared, so a stale one would cover every video after it.
  useEffect(() => {
    setLoadError('player', null)
  }, [playerUrl, splitWatchView, setLoadError])

  // Turning the split on while a video is open moves it into the player and
  // sends the browsing webview back to a page it owns.
  const previousSplitWatchView = useRef(splitWatchView)
  useEffect(() => {
    if (previousSplitWatchView.current === splitWatchView) return
    previousSplitWatchView.current = splitWatchView
    if (isWeb || !isAndroid) {
      return
    }
    if (!splitWatchView) {
      const url = ui$.playerPageUrl.get() || ui$.playerUrl.get() || ui$.browsePageUrl.get() || ui$.pageUrl.get()
      closePlayer()
      setPlayerWebview(null)
      // Reload even if no video was opened, removing the page's split handlers.
      nativeRef.current?.loadUrl(url || 'https://m.youtube.com/')
      return
    }
    const url = ui$.pageUrl.get() || ui$.browsePageUrl.get()
    if (isWatchUrl(url)) {
      openInPlayer(url)
    }
    // The role only reaches the page on its next load (see scriptOnStart).
    nativeRef.current?.loadUrl(
      settings$.isYTMusic.peek() ? 'https://music.youtube.com/' : 'https://m.youtube.com/',
    )
  }, [splitWatchView])

  useObserveEffect(settings$.hideShorts, ({ value }) => toggleShorts(value))
  useObserveEffect(settings$.sponsorBlock, () => syncSettingsToWebview())
  useObserveEffect(settings$.blockAds, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackRate, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackQuality, () => syncSettingsToWebview())
  useObserveEffect(settings$.miniPlayer, () => syncSettingsToWebview())
  useObserveEffect(settings$.pictureInPicture, () => syncSettingsToWebview())
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

  // In Picture-in-Picture the window is barely wider than the video, so the
  // toolbar and every overlay step aside and let the webview have all of it.
  useEffect(() => {
    const subscription = addPictureInPictureListener((active) => ui$.pictureInPicture.set(active))
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

  // Opening a queue video makes it the resume point, so finishing an unrelated
  // video later continues the queue there instead of from its first entry.
  const playingPageUrl = splitWatchView && playerUrl ? playerPageUrl || playerUrl : currentPageUrl
  useEffect(() => {
    trackQueuePlaying(playingPageUrl)
  }, [playingPageUrl])

  const onLoad = async (e: { nativeEvent: any }) => {
    ui$.translation.set(null)
    if (splitWatchView) {
      setSplitPageUrl('browse', e.nativeEvent.url)
      return
    }
    setPageUrl(e.nativeEvent.url)
  }

  const onPlayerLoad = async (e: { nativeEvent: any }) => {
    ui$.translation.set(null)
    setSplitPageUrl('player', e.nativeEvent.url)
    // The load started the page over, so the mini presentation is gone with it.
    reapplyPlayerMode()
  }

  const togglePlayerPlaying = () => {
    const playing = playerPlaying
    setPlayerPlaying(!playing)
    void playerRef.current
      ?.executeJavaScript(playing ? 'window.NouTube?.pause?.()' : 'window.NouTube?.play?.()')
      ?.catch?.(() => undefined)
  }

  // Built once and handed to whichever wrapper is showing, so React keeps the
  // same native view across a mode change instead of remounting it.
  const playerView = (
    <NouTubeView
      ref={playerRef}
      style={{
        flex: 1,
      }}
      useragent={userAgent}
      pullToRefreshEnabled={false}
      textZoom={defaultZoom}
      scriptOnStart={`window.isAndroid = true;\n${splitRolePrelude(splitWatchView, 'player', playerMini)}\n${preludeJs}\n${contentJs}`}
      userScriptsOnStart={userScriptsOnStart}
      onLoad={onPlayerLoad}
      onMessage={onPlayerMessage}
    />
  )

  return (
    <>
      <View
        className={clsx(
          'flex-1 h-full overflow-hidden',
          isWeb && 'lg:flex-row',
          headerPosition === 'bottom' && 'flex-col-reverse',
        )}
      >
        {nIf(!pictureInPicture, <NouHeader getNoutube={getNoutube} />)}
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
            <View style={{ flex: 1 }} pointerEvents={playerFull ? 'none' : 'auto'}>
              <NouTubeView
                ref={nativeRef}
                style={{
                  flex: 1,
                }}
                useragent={userAgent}
                pullToRefreshEnabled={pullToRefreshEnabled}
                textZoom={defaultZoom}
                scriptOnStart={`window.isAndroid = true;\n${splitRolePrelude(splitWatchView, 'browse')}\n${preludeJs}\n${contentJs}`}
                userScriptsOnStart={userScriptsOnStart}
                onLoad={onLoad}
                onMessage={onNativeMessage}
              />
            </View>
            {/* One player webview in three presentations -- covering the app,
                shrunk into the mini player, or waiting offscreen. It is never
                unmounted between them, which is what keeps the video playing
                and makes going back to it free. Even offscreen it stays
                mounted: a detached view would read as a backgrounded app to the
                playback guard (see NouTubeView.onWindowVisibilityChanged). */}
            {nIf(
              splitWatchView,
              <PlayerFrame
                mode={playerUrl ? playerMode : 'hidden'}
                playing={playerPlaying}
                onTogglePlay={togglePlayerPlaying}
              >
                {playerView}
              </PlayerFrame>,
            )}
            {nIf(
              loadError && !pictureInPicture,
              // Above the player, which covers everything below it while shown.
              <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} pointerEvents="box-none">
                <PageLoadError
                  description={loadError?.description}
                  onRetry={() => {
                    // A failed post cannot be replayed through loadUrl, so fall back to the
                    // page the app last navigated to instead of re-requesting it as a GET --
                    // the one belonging to the view that failed, not ui$.url, which in the
                    // split tracks the browsing side.
                    const errored = splitWatchView && playerFull ? 'player' : 'browse'
                    const fallback = splitWatchView
                      ? (errored === 'player' ? ui$.playerPageUrl.get() : ui$.browsePageUrl.get()) ||
                        ui$.url.get()
                      : ui$.url.get()
                    const url = (loadError?.canReload && loadError.url) || fallback
                    setLoadError(errored, null)
                    const view = playerFull ? playerRef.current : nativeRef.current
                    view?.loadUrl(url)
                  }}
                />
              </View>,
            )}
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
