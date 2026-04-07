import 'expo-modules-core-polyfill'
import '@/lib/i18n'
import './global.css'

import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Theme } from '@radix-ui/themes'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useValue } from '@legendapp/state/react'
import { settings$ } from '@/states/settings'

export function Root(): JSX.Element {
  const theme = useValue(settings$.theme)
  const [systemAppearance, setSystemAppearance] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      setSystemAppearance(mediaQuery.matches ? 'dark' : 'light')
    }
    onChange()
    mediaQuery.addEventListener?.('change', onChange)
    mediaQuery.addListener?.(onChange)
    return () => {
      mediaQuery.removeEventListener?.('change', onChange)
      mediaQuery.removeListener?.(onChange)
    }
  }, [])

  return (
    <SafeAreaProvider>
      <Theme className="h-screen" appearance={theme ?? systemAppearance} accentColor="gray" grayColor="slate">
        <App />
      </Theme>
    </SafeAreaProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
