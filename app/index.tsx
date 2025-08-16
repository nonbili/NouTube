import { View, Text, BackHandler, ColorSchemeName, ToastAndroid } from 'react-native'
import { useCallback, useEffect, useState } from 'react'
import { use$, useObserve, useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { fixPageTitle, fixSharingUrl, getPageType, getVideoId, openSharedUrl } from '@/lib/page'
import { Asset } from 'expo-asset'
import { settings$ } from '@/states/settings'
import { useShareIntent } from 'expo-share-intent'
import { useURL } from 'expo-linking'
import { queue$ } from '@/states/queue'
import { EmbedVideoModal } from '@/components/modal/EmbedVideoModal'
import { MainPage } from '@/components/page/MainPage'

export default function HomeScreen() {
  const [scriptOnStart, setScriptOnStart] = useState('')
  const { hasShareIntent, shareIntent } = useShareIntent()
  const linkingUrl = useURL()

  useEffect(() => {
    const url = shareIntent.webUrl || shareIntent.text
    if (hasShareIntent && url) {
      openSharedUrl(url)
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

    const subscription = BackHandler.addEventListener('hardwareBackPress', function () {
      return true
    })

    return () => subscription.remove()
  }, [])

  useObserveEffect(ui$.url, () => {
    ui$.queueModalOpen.set(false)
  })

  return <>{scriptOnStart && <MainPage contentJs={scriptOnStart} />}</>
}
