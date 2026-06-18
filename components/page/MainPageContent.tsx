import { useCallback, useEffect, useRef } from 'react'
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
import { showToast } from '@/lib/toast'
import { clsx, isWeb, nIf } from '@/lib/utils'
import type { WebviewTag } from 'electron'
import { NouHeader } from '../header/NouHeader'
import { syncSupabase } from '@/lib/supabase/sync'
import { auth$ } from '@/states/auth'
import { useMe } from '@/lib/hooks/useMe'
import { ObservableHint } from '@legendapp/state'
import { mainClient } from '@/lib/main-client'
import { onDownloadProgress } from '@/lib/download-progress'
import { downloads$ } from '@/states/downloads'
import { resolveUserAgent } from '@/lib/useragent'
import { handleShortcuts } from '@/desktop/src/renderer/lib/shortcuts'
import { history$ } from '@/states/history'
import { getUserStylesSnapshot, userStyles$ } from '@/states/user-styles'
import { blocklist$, getBlocklistSnapshot } from '@/states/blocklist'
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
  const { sponsorBlock, playbackRate, playbackQuality, miniPlayer, showDislikes, showOriginalVideoTitle } =
    settings$.get()
  return { sponsorBlock, playbackRate, playbackQuality, miniPlayer, showDislikes, showOriginalVideoTitle }
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
    const value = JSON.stringify(getUserStylesSnapshot())
    executeQuietly(webviewRef.current, `window.NouTube?.setUserStyles?.(${value})`)
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
      executeQuietly(webview, `window.isAndroid = false;\n${buildPrelude()}\n${contentJs}`)
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
  const tabs = useValue(tabs$.tabs)
  const activeTabIndex = useValue(tabs$.activeTabIndex)
  const activePageUrl = useValue(tabs$.activePageUrl)
  const nativeRef = useRef<typeof NouTubeViewModule>(null)
  const hideShorts = useValue(settings$.hideShorts)
  const isYTMusic = useValue(settings$.isYTMusic)
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const headerPosition = useValue(settings$.headerPosition)
  const pullToRefreshEnabled = useValue(settings$.pullToRefreshEnabled)
  const defaultZoom = useValue(settings$.defaultZoom)
  const customUserAgent = useValue(settings$.userAgent)
  const desktopModeYTMusic = useValue(settings$.desktopMode)
  const desktopModeYT = useValue(settings$.desktopModeYT)
  const desktopMode = isYTMusic ? desktopModeYTMusic : desktopModeYT
  const preferH264 = useValue(settings$.preferH264)
  const clickbaitThumbnail = useValue(settings$.clickbaitThumbnail)
  const blocklistState = useValue(blocklist$)
  const buildPrelude = () =>
    `window.NouTubeInitialSettings = ${JSON.stringify(getContentSettingsSnapshot())};` +
    `window.NouTubePreferH264 = ${settings$.preferH264.get() ? 'true' : 'false'};` +
    `window.NouTubeClickbaitThumbnail = ${JSON.stringify(settings$.clickbaitThumbnail.get())};` +
    `window.NouTubeBlocklist = ${JSON.stringify(getBlocklistSnapshot())};`
  const contentSettings = getContentSettingsSnapshot()
  const preludeJs =
    `window.NouTubeInitialSettings = ${JSON.stringify(contentSettings)};` +
    `window.NouTubePreferH264 = ${preferH264 ? 'true' : 'false'};` +
    `window.NouTubeClickbaitThumbnail = ${JSON.stringify(clickbaitThumbnail)};` +
    `window.NouTubeBlocklist = ${JSON.stringify(getBlocklistSnapshot(blocklistState))};`
  const { userId, me } = useMe()
  const userAgent = resolveUserAgent(
    isWeb ? window.electron.process.platform : 'android',
    customUserAgent,
    desktopMode,
  )
  const getNoutube = useCallback(() => ui$.webview.get() || nativeRef.current, [])

  useEffect(() => {
    if (isWeb) {
      void mainClient.setBlocklist(getBlocklistSnapshot())
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
          downloads$[payload.url].assign({
            phase: 'error',
            errorMsg: payload.line || 'Download failed',
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
    const value = JSON.stringify(getUserStylesSnapshot())
    ref?.executeJavaScript(`window.NouTube.setUserStyles(${value})`)
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
    if (!isWeb && !ui$.url.get()) {
      ui$.url.set(isYTMusic ? 'https://music.youtube.com' : isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com')
    }
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

  const onMessage = useCallback(async (type: string, data: any) => {
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
      case 'onload':
        const webview = ui$.webview.get() || nativeRef.current
        restoreLastPlaying(webview)
        if (!isWeb) {
          toggleShorts(hideShorts)
          syncUserStylesToWebview()
          syncBlocklistToWebview()
          syncSettingsToWebview()
        }
        if (isWeb) {
          webview?.executeJavaScript('window.NouTube.bridgeShortcuts()')
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
  }, [
    autoHideHeader,
    hideShorts,
    hideToolbarWhenScrolled,
    syncSettingsToWebview,
    syncBlocklistToWebview,
    syncUserStylesToWebview,
    toggleShorts,
    activePageUrl,
    pageUrl,
  ])

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

  const onLoad = async (e: { nativeEvent: any }) => {
    setPageUrl(e.nativeEvent.url)
  }

  return (
    <>
      <View
        className={clsx(
          'flex-1 h-full lg:flex-row overflow-hidden',
          headerPosition === 'bottom' && 'flex-col-reverse',
        )}
      >
        <NouHeader getNoutube={getNoutube} />
        {nIf(isWeb, <SettingsModal />)}
        {isWeb ? (
          <View className="relative flex-1 min-h-0">
            {tabs.map((tab, index) => (
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
          <NouTubeView
            ref={nativeRef}
            style={{ flex: 1 }}
            useragent={userAgent}
            pullToRefreshEnabled={pullToRefreshEnabled}
            textZoom={defaultZoom}
            scriptOnStart={`window.isAndroid = true;\n${preludeJs}\n${contentJs}`}
            onLoad={onLoad}
            onMessage={onNativeMessage}
          />
        )}
        {nIf(
          embedVideoId,
          <EmbedVideoModal
            videoId={embedVideoId}
            scriptOnStart={`${isWeb ? 'window.isAndroid = false;' : 'window.isAndroid = true;'}\n${preludeJs}\n${contentJs}`}
            onClose={() => ui$.embedVideoId.set('')}
          />,
        )}
      </View>
    </>
  )
}
