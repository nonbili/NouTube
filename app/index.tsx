import { BackHandler } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { useObserveEffect } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { openSharedUrl } from '@/lib/page'
import { Asset } from 'expo-asset'
import { useIncomingShare } from 'expo-sharing'
import { parseSharedUrl } from '@/lib/share-intent'
import * as Linking from 'expo-linking'
import { MainPage } from '@/components/page/MainPage'
import { isAndroid, nIf } from '@/lib/utils'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { settings$ } from '@/states/settings'
import { sleepTimer$ } from '@/states/sleep-timer'
import { showToast } from '@/lib/toast'
import { t } from 'i18next'
import { addSleepTimerListener, getNativeSleepTimerRemainingMs, hasSleepTimerNativeSupport } from '@/lib/sleep-timer-native'

const syncNativeSettings = () => {
  const settings = settings$.get()
  NouTubeViewModule.setSettings({
    proxyEnabled: settings.proxyEnabled,
    proxyType: settings.proxyType,
    proxyHost: settings.proxyHost,
    proxyPort: settings.proxyPort,
  })
}

export default function HomeScreen() {
  const [scriptOnStart, setScriptOnStart] = useState('')
  const { resolvedSharedPayloads, clearSharedPayloads, isResolving } = useIncomingShare()
  const handledPayloadKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (isResolving) {
      return
    }
    if (resolvedSharedPayloads.length === 0) {
      handledPayloadKeyRef.current = null
      return
    }

    const payload = resolvedSharedPayloads[0]
    const key = `${payload.contentType ?? 'text'}:${payload.contentUri ?? ''}:${payload.value}`
    if (handledPayloadKeyRef.current === key) {
      return
    }
    handledPayloadKeyRef.current = key

    let url: string | null = null
    if (payload.contentType === 'website' && payload.contentUri) {
      url = payload.contentUri
    } else {
      url = parseSharedUrl({ webUrl: payload.contentUri ?? undefined, text: payload.value ?? undefined })
    }

    if (url) {
      openSharedUrl(url)
    }

    clearSharedPayloads()
  }, [resolvedSharedPayloads, isResolving, clearSharedPayloads])

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

    if (isAndroid) {
      syncNativeSettings()
    }

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

  useObserveEffect(settings$, () => {
    if (isAndroid) {
      syncNativeSettings()
    }
  })

  return nIf(scriptOnStart, <MainPage contentJs={scriptOnStart} />)
}
