import { useCallback, useEffect, useRef, useState } from 'react'
import { use$, useObserve, useObserveEffect } from '@legendapp/state/react'
import { onClearData$, ui$ } from '@/states/ui'
import { queue$ } from '@/states/queue'
import { settings$ } from '@/states/settings'
import { bookmarks$, migrateWatchlist, newBookmark } from '@/states/bookmarks'
import { EmbedVideoModal } from '@/components/modal/EmbedVideoModal'
import NouTubeViewModule, { NouTubeView } from '@/modules/nou-tube-view'
import { View, Text, BackHandler, ColorSchemeName } from 'react-native'
import { fixPageTitle, fixSharingUrl, getPageType, getVideoId, setPageUrl } from '@/lib/page'
import { showToast } from '@/lib/toast'
import { isWeb, nIf } from '@/lib/utils'
import type { WebviewTag } from 'electron'
import { NouHeader } from '../header/NouHeader'
import { syncSupabase } from '@/lib/supabase/sync'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { getMeQuery } from '@/lib/query'
import { auth$ } from '@/states/auth'
import { useMe } from '@/lib/hooks/useMe'
import { ObservableHint } from '@legendapp/state'
import { mainClient } from '@/desktop/src/renderer/ipc/main'
import { getUserAgent } from '@/lib/webview'

const userAgent = getUserAgent()
let restored = false

function restoreLastPlaying(webview: any) {
  if (settings$.restoreOnStart.get() && !restored) {
    restored = true
    webview.executeJavaScript('window.NouTube.restoreLastPlaying()')
  }
}

export const MainPageContent: React.FC<{ contentJs: string }> = ({ contentJs }) => {
  const uiState = use$(ui$)
  const nativeRef = useRef<typeof NouTubeViewModule>(null)
  const webviewRef = useRef<WebviewTag>(null)
  const webviewReadyRef = useRef(false)
  const hideShorts = use$(settings$.hideShorts)
  const isYTMusic = use$(settings$.isYTMusic)
  const { userId, me } = useMe()

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

  const syncSettingsToWebview = useCallback(() => {
    if (webviewRef.current && !webviewReadyRef.current) {
      return
    }
    const ref = webviewRef.current || nativeRef.current
    const { sponsorBlock } = settings$.get()
    const value = JSON.stringify({ sponsorBlock })
    ref?.executeJavaScript(`localStorage.setItem('nou:settings', '${value}')`)
  }, [nativeRef, webviewRef])

  useEffect(() => {
    if (!ui$.url.get()) {
      ui$.url.set(isYTMusic ? 'https://music.youtube.com' : isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com')
    }

    migrateWatchlist()
  }, [])

  useEffect(() => {
    auth$.plan.set(me?.plan)
    let timer: number
    if (userId && me?.plan && me.plan != 'free') {
      syncSupabase()
      timer = setInterval(
        () => syncSupabase(),
        10 * 60 * 1000, // 10 minutes
      )
    }
    return () => clearInterval(timer)
  }, [me?.plan, userId])

  const onMessage = useCallback(async (type: string, data: any) => {
    switch (type) {
      case '[content]':
      case '[kotlin]':
        console.log(type, data)
        break
      case 'onload':
        const webview = webviewRef.current || nativeRef.current
        restoreLastPlaying(webview)
        break
      case 'add-queue':
        queue$.addBookmark(data)
        showToast(`Added to queue`)
        break
      case 'star':
        bookmarks$.addBookmark(newBookmark(data))
        showToast(`Saved to bookmarks`)
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
    }
  }, [])

  const onNativeMessage = async (e: { nativeEvent: { payload: string } }) => {
    const { payload } = e.nativeEvent
    const { type, data } = typeof payload == 'string' ? JSON.parse(payload) : payload
    onMessage(type, data)
  }

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }

    webview.addEventListener('dom-ready', () => {
      // webview.openDevTools()

      ui$.webview.set(ObservableHint.opaque(webview))
      webviewReadyRef.current = true
      webview.executeJavaScript(contentJs)
      toggleShorts(hideShorts)
      syncSettingsToWebview()
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

  const onLoad = async (e: { nativeEvent: any }) => {
    setPageUrl(e.nativeEvent.url)
    const webview = nativeRef.current
    if (webview) {
      webview.executeJavaScript("document.querySelector('#movie_player')?.unMute()")
      toggleShorts(hideShorts)
      syncSettingsToWebview()
    }
  }

  return (
    <>
      <View className="flex-1 h-full lg:flex-row overflow-hidden">
        <NouHeader noutube={webviewRef.current || nativeRef.current} />
        {isWeb ? (
          <NouTubeView ref={webviewRef} style={{ flex: 1 }} useragent={userAgent} partition="persist:webview" />
        ) : (
          <NouTubeView
            ref={nativeRef}
            style={{ flex: 1 }}
            useragent={userAgent}
            scriptOnStart={contentJs}
            onLoad={onLoad}
            onMessage={onNativeMessage}
          />
        )}
        {nIf(
          uiState.embedVideoId,
          <EmbedVideoModal
            videoId={uiState.embedVideoId}
            scriptOnStart={contentJs}
            onClose={() => ui$.embedVideoId.set('')}
          />,
        )}
      </View>
    </>
  )
}
