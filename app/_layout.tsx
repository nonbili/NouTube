import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { DrawerContent } from '@/components/drawer/DrawerContent'
import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'

import './global.css'
import { settings$ } from '@/states/settings'
import { Appearance } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view/src/NouTubeViewModule'
import { useObserveEffect } from '@legendapp/state/react'

export default function RootLayout() {
  useObserveEffect(settings$.theme, ({ value }) => {
    Appearance.setColorScheme(value)
    NouTubeViewModule.setTheme(value)
  })

  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <GestureHandlerRootView>
        <Drawer drawerContent={DrawerContent} />
      </GestureHandlerRootView>
    </ThemeProvider>
  )
}
