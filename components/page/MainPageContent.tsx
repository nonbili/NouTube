import { useCallback, useEffect, useRef, useState } from 'react'
import { use$, useObserve, useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { queue$ } from '@/states/queue'
import { settings$ } from '@/states/settings'
import { bookmarks$, migrateWatchlist, newBookmark } from '@/states/bookmarks'
import { EmbedVideoModal } from '@/components/modal/EmbedVideoModal'
import NouTubeViewModule, { NouTubeView } from '@/modules/nou-tube-view'
import { View, Text, BackHandler, ColorSchemeName } from 'react-native'
import { fixPageTitle, fixSharingUrl, getPageType, getVideoId } from '@/lib/page'
import { showToast } from '@/lib/toast'
import { isWeb } from '@/lib/utils'
import type { WebviewTag } from 'electron'
import { NouHeader } from '../header/NouHeader'
import { LibraryModal } from '../modal/LibraryModal'
import { QueueModal } from '../modal/QueueModal'
import { SettingsModal } from '../modal/SettingsModal'
import { syncBookmarks } from '@/lib/supabase/sync'
import { useQuery, UseQueryResult } from '@tanstack/react-query'
import { getMeQuery } from '@/lib/query'
import { auth$ } from '@/states/auth'
import { useMe } from '@/lib/hooks/useMe'

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

  useEffect(() => {
    ui$.url.set(isYTMusic ? 'https://music.youtube.com' : isWeb ? 'https://www.youtube.com' : 'https://m.youtube.com')

    migrateWatchlist()
  }, [])

  useEffect(() => {
    auth$.plan.set(me?.plan)
    syncBookmarks()
    let timer: number
    if (userId && me?.plan && me.plan != 'free') {
      timer = setInterval(
        () => syncBookmarks(),
        30 * 60 * 1000, // 30 minutes
      )
    }
    return () => clearInterval(timer)
  }, [me?.plan, userId])

  const onMessage = useCallback(async (type: string, data: any) => {
    switch (type) {
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
    const { type, data } = JSON.parse(e.nativeEvent.payload)
    onMessage(type, data)
  }

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) {
      return
    }

    webview.addEventListener('dom-ready', () => {
      /* webview.openDevTools() */
      webviewReadyRef.current = true
      webview.executeJavaScript(contentJs)
      toggleShorts(hideShorts)
    })
    webview.addEventListener('did-start-loading', (e) => {
      const { host } = new URL(webview.src)
      settings$.home.set(host == 'music.youtube.com' ? 'yt-music' : 'yt')
    })
    webview.addEventListener('did-navigate', (e) => {
      ui$.pageUrl.set(e.url)
    })
    webview.addEventListener('did-navigate-in-page', (e) => {
      ui$.pageUrl.set(e.url)
    })
    webview.addEventListener('ipc-message', (e) => {
      onMessage(e.channel, e.args[0])
    })
  }, [webviewRef])

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

  const onLoad = async (e: { nativeEvent: any }) => {
    const { url } = e.nativeEvent
    if (url) {
      ui$.pageUrl.set(url)
      const { host } = new URL(url)
      settings$.home.set(host == 'music.youtube.com' ? 'yt-music' : 'yt')
    }
    const webview = nativeRef.current
    if (webview) {
      webview.executeJavaScript("document.querySelector('#movie_player')?.unMute()")
      toggleShorts(hideShorts)
    }
  }

  return (
    <>
      <View className="flex-1 h-full lg:flex-row overflow-hidden">
        <NouHeader noutube={webviewRef.current || nativeRef.current} />
        {isWeb ? (
          // @ts-expect-error ??
          <NouTubeView className="flex-1" ref={webviewRef} partition="persist:webview" />
        ) : (
          <NouTubeView
            // @ts-expect-error ??
            ref={nativeRef}
            style={{ flex: 1 }}
            scriptOnStart={contentJs}
            onLoad={onLoad}
            onMessage={onNativeMessage}
          />
        )}
        {uiState.embedVideoId && (
          <EmbedVideoModal
            videoId={uiState.embedVideoId}
            scriptOnStart={contentJs}
            onClose={() => ui$.embedVideoId.set('')}
          />
        )}
      </View>
      <LibraryModal />
      <QueueModal />
      <SettingsModal />
    </>
  )
}
