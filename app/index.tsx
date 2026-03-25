import { BackHandler } from 'react-native'
import { useEffect, useState } from 'react'
import { useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { openSharedUrl } from '@/lib/page'
import { Asset } from 'expo-asset'
import { useShareIntent } from 'expo-share-intent'
import * as Linking from 'expo-linking'
import { MainPage } from '@/components/page/MainPage'
import { isAndroid, nIf } from '@/lib/utils'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { sleepTimer$ } from '@/states/sleep-timer'
import { showToast } from '@/lib/toast'
import { t } from 'i18next'
import { addSleepTimerListener, getNativeSleepTimerRemainingMs, hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'

export default function HomeScreen() {
  const [scriptOnStart, setScriptOnStart] = useState('')
  const { hasShareIntent, shareIntent } = useShareIntent()

  useEffect(() => {
    const url = shareIntent.webUrl || shareIntent.text
    if (hasShareIntent && url) {
      openSharedUrl(url)
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

    // @ts-expect-error
    NouTubeViewModule.addListener('log', (evt) => {
      console.log('[kotlin]', evt.msg)
    })

    let sleepTimerSubscription: { remove?: () => void } | undefined
    if (isAndroid && hasSleepTimerNativeSupport()) {
      void getNativeSleepTimerRemainingMs()
        .then((remainingMs) => sleepTimer$.setRemainingMs(remainingMs))
        .catch((error) => {
          console.error('getSleepTimerRemainingMs failed', error)
        })

      sleepTimerSubscription = addSleepTimerListener((evt) => {
        sleepTimer$.setRemainingMs(evt.remainingMs ?? null)
        if (evt.reason === 'expired') {
          showToast(t('sleepTimer.expiredToast'))
        }
      })
    } else {
      sleepTimer$.clear()
    }

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', function () {
      const webview = ui$.webview.get()
      webview?.goBack()
      return true
    })

    return () => {
      sleepTimerSubscription?.remove?.()
      backSubscription.remove()
    }
  }, [])

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (e) => {
      openSharedUrl(e.url)
    })
    return () => subscription.remove()
  }, [])

  useObserveEffect(ui$.url, () => {
    ui$.queueModalOpen.set(false)
  })

  return nIf(scriptOnStart, <MainPage contentJs={scriptOnStart} />)
}
