import '@/lib/i18n'
import './global.css'

import { StatusBar } from 'expo-status-bar'
import { settings$ } from '@/states/settings'
import { Appearance, View, useColorScheme } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { useObserveEffect, useValue } from '@legendapp/state/react'
import { Slot } from 'expo-router'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import { ui$ } from '@/states/ui'
import { nIf } from '@/lib/utils'

function RootLayoutContent() {
  useObserveEffect(settings$.theme, ({ value }) => {
    Appearance.setColorScheme?.(value ?? 'unspecified')
  })

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
