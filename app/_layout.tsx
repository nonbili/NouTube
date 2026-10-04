import '@/lib/i18n'
import './global.css'

import { StatusBar } from 'expo-status-bar'
import { settings$ } from '@/states/settings'
import { AppState, Appearance, View, useColorScheme } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { useObserveEffect, useValue } from '@legendapp/state/react'
import { Slot } from 'expo-router'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { ui$ } from '@/states/ui'
import { nIf } from '@/lib/utils'
import { applyPalette, getDynamicPalette } from '@/lib/dynamic-palette'
import { dynamicPalette$ } from '@/lib/theme'
import { syncFeedNotificationTask } from '@/lib/feed-notifications'

function RootLayoutContent() {
  const feedsEnabled = useValue(settings$.feedsEnabled)
  const feedNotificationsEnabled = useValue(settings$.feedNotificationsEnabled)
  useEffect(() => {
    const reconcile = () => {
      void syncFeedNotificationTask().catch((error) => console.error('Feed background task registration failed:', error))
    }
    reconcile()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reconcile()
    })
    return () => subscription.remove()
  }, [feedsEnabled, feedNotificationsEnabled])

  useObserveEffect(settings$.theme, ({ value }) => {
    Appearance.setColorScheme?.(value ?? 'unspecified')
  })

  const dynamicColor = useValue(settings$.dynamicColor)
  useEffect(() => {
    const update = () => {
      const palette = dynamicColor ? getDynamicPalette() : null
      if (JSON.stringify(palette) !== JSON.stringify(dynamicPalette$.peek())) {
        dynamicPalette$.set(palette)
        applyPalette(palette)
      }
    }
    update()
    // The wallpaper may have changed while the app was in the background.
    const sub = AppState.addEventListener('change', (state) => state === 'active' && update())
    return () => sub.remove()
  }, [dynamicColor])

  useEffect(() => {
    return () => {
      ;(NouTubeViewModule as any).exit?.()
    }
  }, [])

  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'
  const pictureInPicture = useValue(ui$.pictureInPicture)

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {nIf(
        !pictureInPicture,
        <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.top, zIndex: 10 }} />,
      )}
      <Slot />
      {nIf(
        !pictureInPicture,
        <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.bottom }} />,
      )}
    </>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  )
}
