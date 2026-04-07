import '@/lib/i18n'
import './global.css'

import { StatusBar } from 'expo-status-bar'
import { settings$ } from '@/states/settings'
import { Appearance, View, useColorScheme } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { useObserveEffect } from '@legendapp/state/react'
import { Slot } from 'expo-router'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect } from 'react'

function RootLayoutContent() {
  useObserveEffect(settings$.theme, ({ value }) => {
    Appearance.setColorScheme?.(value)
    NouTubeViewModule.setTheme(value)
  })

  useEffect(() => {
    return () => {
      NouTubeViewModule.exit()
    }
  }, [])

  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.top, zIndex: 10 }} />
      <Slot />
      <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.bottom }} />
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
