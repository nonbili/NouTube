import { useCallback, useEffect, useRef } from 'react'
import { useValue, useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { queue$ } from '@/states/queue'
import { settings$ } from '@/states/settings'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { createLogger } from '@/lib/log'
import { EmbedVideoModal } from '@/components/modal/EmbedVideoModal'
import NouTubeViewModule, { NouTubeView } from '@/modules/nou-tube-view'
import { View } from 'react-native'
import { getVideoId, setPageUrl } from '@/lib/page'
import { showToast } from '@/lib/toast'
import { isWeb, nIf } from '@/lib/utils'
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
  if (settings$.restoreOnStart.get() && !restored) {
    restored = true
    webview.executeJavaScript('window.NouTube.restoreLastPlaying()')
  }
}

export const MainPageContent: React.FC<{ contentJs: string }> = ({ contentJs }) => {
  const uiState = useValue(ui$)
  const nativeRef = useRef<typeof NouTubeViewModule>(null)
  const webviewRef = useRef<WebviewTag>(null)
  const webviewReadyRef = useRef(false)
  const hideShorts = useValue(settings$.hideShorts)
  const isYTMusic = useValue(settings$.isYTMusic)
  const autoHideHeader = useValue(settings$.autoHideHeader)
  const hideToolbarWhenScrolled = useValue(settings$.hideToolbarWhenScrolled)
  const customUserAgent = useValue(settings$.userAgent)
  const desktopMode = useValue(settings$.desktopMode)
  const { userId, me } = useMe()
  const userAgent = resolveUserAgent(
    isWeb ? window.electron.process.platform : 'android',
    customUserAgent,
    desktopMode,
  )

  useEffect(() => {
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
      if (webviewRef.current && !webviewReadyRef.current) {
        return
      }
      const ref = webviewRef.current || nativeRef.current
      ref?.executeJavaScript(hide ? 'NouTube.hideShorts()' : 'NouTube.showShorts()')
    },
    [nativeRef, webviewRef],
  )

  const syncUserStylesToWebview = useCallback(() => {
    if (webviewRef.current && !webviewReadyRef.current) {
      return
    }
    const ref = webviewRef.current || nativeRef.current
    const value = JSON.stringify(getUserStylesSnapshot())
    ref?.executeJavaScript(`window.NouTube.setUserStyles(${value})`)
  }, [nativeRef, webviewRef])

  const syncSettingsToWebview = useCallback(() => {
    if (webviewRef.current && !webviewReadyRef.current) {
      return
    }
    const ref = webviewRef.current || nativeRef.current
    const { sponsorBlock, playbackRate } = settings$.get()
    const value = JSON.stringify({ sponsorBlock, playbackRate })
    ref?.executeJavaScript(`localStorage.setItem('nou:settings', '${value}')`)
  }, [nativeRef, webviewRef])

  useEffect(() => {
    if (!ui$.url.get()) {
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
        const webview = webviewRef.current || nativeRef.current
        restoreLastPlaying(webview)
        toggleShorts(hideShorts)
        syncUserStylesToWebview()
        syncSettingsToWebview()
        if (isWeb) {
          uiState.webview.executeJavaScript('window.NouTube.bridgeShortcuts()')
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
      case 'playback-end':
        const videoId = getVideoId(uiState.pageUrl)
        const bookmarks = queue$.bookmarks.get()
        if (videoId && bookmarks.length) {
          const queueIndex = bookmarks.findIndex((x) => getVideoId(x.url) == videoId)
          if (queueIndex != bookmarks.length - 1) {
            ui$.url.set(bookmarks[queueIndex + 1].url)
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
    }
  }, [
    autoHideHeader,
    hideShorts,
    hideToolbarWhenScrolled,
    syncSettingsToWebview,
    syncUserStylesToWebview,
    toggleShorts,
    uiState.pageUrl,
    uiState.webview,
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
    const webview = webviewRef.current
    if (!webview) {
      return
    }

    webview.addEventListener('dom-ready', () => {
      // webview.openDevTools()

      ui$.webview.set(ObservableHint.opaque(webview))
      webviewReadyRef.current = true
      webview.executeJavaScript(`window.isAndroid = false;\n${contentJs}`)
    })
    webview.addEventListener('did-navigate', (e) => {
      const { host } = new URL(e.url)
      mainClient.toggleInterception(['m.youtube.com', 'music.youtube.com', 'www.youtube.com'].includes(host))
      const pageUrl = uiState.pageUrl
      setPageUrl(e.url)
      if (pageUrl && host != new URL(pageUrl).host) {
        uiState.webview.executeJavaScript('document.location.reload()')
      }
    })
    webview.addEventListener('did-navigate-in-page', (e) => {
      setPageUrl(e.url)
    })
    webview.addEventListener('ipc-message', (e) => {
      onMessage(e.channel, e.args[0])
    })
  }, [webviewRef])

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
    const webview = webviewRef.current
    const native = nativeRef.current
    try {
      if (value && new URL(value).pathname != '/' && !restored) {
        restored = true
      }
    } catch (e) {}
    if (value) {
      if (webview) {
        webview.src = value
      } else if (native) {
        native.loadUrl(value)
      }
    }
  })

  useObserveEffect(settings$.hideShorts, ({ value }) => toggleShorts(value))
  useObserveEffect(settings$.sponsorBlock, () => syncSettingsToWebview())
  useObserveEffect(settings$.playbackRate, () => syncSettingsToWebview())
  useObserveEffect(userStyles$, () => syncUserStylesToWebview())

  const onLoad = async (e: { nativeEvent: any }) => {
    setPageUrl(e.nativeEvent.url)
  }

  return (
    <>
      <View className="flex-1 h-full lg:flex-row overflow-hidden">
        <NouHeader noutube={webviewRef.current || nativeRef.current} />
        {isWeb ? (
          <NouTubeView
            ref={webviewRef}
            style={{ flex: 1 }}
            useragent={userAgent}
            partition="persist:webview"
            allowpopups="true"
          />
        ) : (
          <NouTubeView
            ref={nativeRef}
            style={{ flex: 1 }}
            useragent={userAgent}
            scriptOnStart={`window.isAndroid = true;\n${contentJs}`}
            onLoad={onLoad}
            onMessage={onNativeMessage}
          />
        )}
        {nIf(
          uiState.embedVideoId,
          <EmbedVideoModal
            videoId={uiState.embedVideoId}
            scriptOnStart={`${isWeb ? 'window.isAndroid = false;' : 'window.isAndroid = true;'}\n${contentJs}`}
            onClose={() => ui$.embedVideoId.set('')}
          />,
        )}
      </View>
    </>
  )
}
