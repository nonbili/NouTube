import { View, Text, BackHandler } from 'react-native'
import { NouTubeView } from '@/modules/nou-tube-view'
import { useCallback, useEffect, useRef, useState } from 'react'
import { use$, useObserve } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { DrawerActions, useNavigation } from '@react-navigation/native'
import { fixPageTitle, getPageType } from '@/lib/page'
import { Asset } from 'expo-asset'
import { settings$ } from '@/states/settings'
import { useShareIntent } from 'expo-share-intent'
import { DrawerScreen } from '@/components/drawer/DrawerScreen'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

export default function HomeScreen() {
  const navigation = useNavigation()
  const uiState = use$(ui$)
  const isYTMusic = use$(settings$.isYTMusic)
  const [scriptOnStart, setScriptOnStart] = useState('')
  const { hasShareIntent, shareIntent } = useShareIntent()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (hasShareIntent && shareIntent.webUrl) {
      const { host } = new URL(shareIntent.webUrl)
      if (['www.youtbue.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
        ui$.url.set(shareIntent.webUrl)
      }
    }
  }, [hasShareIntent, shareIntent])

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

    return () => subscription.remove()
  }, [])

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
    ref.current.eval("document.querySelector('video')?.muted=false")
    navigation.dispatch(DrawerActions.closeDrawer)
  }

  const onMessage = async (e: { nativeEvent: { payload: string } }) => {}

  const ref = useRef<any>(null)

  return (
    <>
      <DrawerScreen noutube={ref.current} />

      <View style={{ flex: 1, paddingBottom: insets.bottom }}>
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
      </View>
    </>
  )
}
