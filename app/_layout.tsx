import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Drawer } from 'expo-router/drawer'
import { DrawerContent } from '@/components/drawer/DrawerContent'
import { DarkTheme, ThemeProvider } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'

import './global.css'

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <GestureHandlerRootView>
        <Drawer drawerContent={DrawerContent} />
      </GestureHandlerRootView>
    </ThemeProvider>
  )
}
