import { View, Text, BackHandler, Appearance, ColorSchemeName, ToastAndroid } from 'react-native'
import { NouTubeView } from '@/modules/nou-tube-view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { use$, useObserve, useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { fixPageTitle, fixSharingUrl, getPageType, getVideoId } from '@/lib/page'
import { Asset } from 'expo-asset'
import { settings$ } from '@/states/settings'
import { useShareIntent } from 'expo-share-intent'
import { DrawerScreen } from '@/components/drawer/DrawerScreen'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useURL } from 'expo-linking'
import { reloadAppAsync } from 'expo'
import { QueueModal } from '@/components/modal/QueueModal'
import { queue$ } from '@/states/queue'
import { watchlist$ } from '@/states/watchlist'

function openSharedUrl(url: string) {
  try {
    const { host } = new URL(fixSharingUrl(url))
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      ui$.url.set(url)
    }
  } catch (e) {
    console.error(e)
  }
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const uiState = use$(ui$)
  const isYTMusic = use$(settings$.isYTMusic)
  const hideShorts = use$(settings$.hideShorts)
  const [scriptOnStart, setScriptOnStart] = useState('')
  const { hasShareIntent, shareIntent } = useShareIntent()
  const insets = useSafeAreaInsets()
  const ref = useRef<any>(null)
  const linkingUrl = useURL()

  const toggleShorts = useCallback(
    (hide?: boolean) => {
      ref.current?.eval(hide ? 'NouTube.hideShorts()' : 'NouTube.showShorts()')
    },
    [ref.current],
  )

  useEffect(() => {
    if (hasShareIntent && shareIntent.webUrl) {
      openSharedUrl(shareIntent.webUrl)
    }
  }, [hasShareIntent, shareIntent])

  useEffect(() => {
    if (linkingUrl) {
      openSharedUrl(linkingUrl)
    }
  }, [linkingUrl])

  useEffect(() => {
    ;(async () => {
      const [{ localUri }] = await Asset.loadAsync(require('../assets/scripts/main.bjs'))
      if (localUri) {
        const res = await fetch(localUri)
        const content = await res.text()
        setScriptOnStart(content)
      }
    })()

    ui$.url.set(isYTMusic ? 'https://music.youtube.com' : 'https://m.youtube.com')

    const subscription = BackHandler.addEventListener('hardwareBackPress', function () {
      return true
    })

    Appearance.addChangeListener(() => reloadAppAsync())
    return () => subscription.remove()
  }, [])

  useObserveEffect(settings$.hideShorts, ({ value }) => toggleShorts(value))

  useObserveEffect(settings$.theme, ({ value }) => Appearance.setColorScheme(value))

  useObserveEffect(ui$.url, () => {
    navigation.dispatch(DrawerActions.closeDrawer)
    ui$.queueModalShown.set(false)
  })

  const onLoad = async (e: { nativeEvent: any }) => {
    const { url, title: _title } = e.nativeEvent
    const title = fixPageTitle(_title || '')
    if (url) {
      ui$.pageUrl.set(url)
      const { host } = new URL(url)
      settings$.home.set(host == 'music.youtube.com' ? 'yt-music' : 'yt')
    }
    if (title) {
      ui$.title.set(title)
    }
    const webview = ref.current
    ref.current.eval("document.querySelector('#movie_player')?.unMute()")
    toggleShorts(hideShorts)
  }

  const onMessage = async (e: { nativeEvent: { payload: string } }) => {
    const { type, data } = JSON.parse(e.nativeEvent.payload)
    switch (type) {
      case 'add-queue':
        queue$.addBookmark(data)
        ToastAndroid.show(`🎉 Added to queue`, ToastAndroid.SHORT)
        break
      case 'star':
        watchlist$.addBookmark(data)
        ToastAndroid.show(`🎉 Saved to watchlist`, ToastAndroid.SHORT)
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
    }
  }

  return (
    <>
      <DrawerScreen noutube={ref.current} />

      <SafeAreaView style={{ flex: 1 }} edges={['right', 'bottom']}>
        {scriptOnStart && (
          <NouTubeView
            // @ts-expect-error ??
            ref={ref}
            style={{ flex: 1 }}
            url={uiState.url}
            scriptOnStart={scriptOnStart}
            onLoad={onLoad}
            onMessage={onMessage}
          />
        )}

        {uiState.queueModalShown && <QueueModal onClose={() => ui$.queueModalShown.set(false)} />}
      </SafeAreaView>
    </>
  )
}
