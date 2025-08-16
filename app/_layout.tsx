import './global.css'

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { settings$ } from '@/states/settings'
import { Appearance, View } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view/src/NouTubeViewModule'
import { useObserveEffect } from '@legendapp/state/react'
import { Slot } from 'expo-router'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

export default function RootLayout() {
  useObserveEffect(settings$.theme, ({ value }) => {
    Appearance.setColorScheme(value)
    NouTubeViewModule.setTheme(value)
  })

  const insets = useSafeAreaInsets()

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View className="bg-zinc-800" style={{ height: insets.top }} />
      <Slot />
      <View className="bg-zinc-800" style={{ height: insets.bottom }} />
    </SafeAreaProvider>
  )
}
