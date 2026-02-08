import 'expo-modules-core-polyfill'
import '@/lib/i18n'
import './global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Theme } from '@radix-ui/themes'
import { SafeAreaProvider } from 'react-native-safe-area-context'

createRoot(document.getElementById('root')!).render(
  <SafeAreaProvider>
    <Theme className="h-screen" appearance="dark" accentColor="gray" grayColor="slate">
      <App />
    </Theme>
  </SafeAreaProvider>,
)
