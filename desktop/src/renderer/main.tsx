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
import { Appearance } from 'react-native'

// Patch Appearance for react-native-web
const originalAppearance = Appearance as any
let customColorScheme: 'dark' | 'light' | null = null
const listeners = new Set<(appearance: { colorScheme: 'dark' | 'light' }) => void>()

if (typeof originalAppearance.setColorScheme !== 'function') {
  const getColorScheme = () => {
    if (customColorScheme) return customColorScheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  originalAppearance.setColorScheme = (scheme: 'dark' | 'light' | null) => {
    customColorScheme = scheme
    const appearance = { colorScheme: getColorScheme() }
    listeners.forEach((l) => l(appearance))
  }

  const originalGetColorScheme = originalAppearance.getColorScheme
  originalAppearance.getColorScheme = getColorScheme

  const originalAddChangeListener = originalAppearance.addChangeListener
  originalAppearance.addChangeListener = (listener: any) => {
    listeners.add(listener)
    const sub = originalAddChangeListener ? originalAddChangeListener(listener) : { remove: () => {} }
    return {
      remove: () => {
        listeners.delete(listener)
        if (sub.remove) sub.remove()
      },
    }
  }
}

export function Root(): JSX.Element {
  const theme = useValue(settings$.theme)
  const [systemAppearance, setSystemAppearance] = useState<'dark' | 'light'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => {
      const appearance = mediaQuery.matches ? 'dark' : 'light'
      setSystemAppearance(appearance)
      if (!theme) {
        listeners.forEach((l) => l({ colorScheme: appearance }))
      }
    }
    onChange()
    mediaQuery.addEventListener?.('change', onChange)
    mediaQuery.addListener?.(onChange)
    return () => {
      mediaQuery.removeEventListener?.('change', onChange)
      mediaQuery.removeListener?.(onChange)
    }
  }, [theme])

  useEffect(() => {
    const appearance = theme ?? systemAppearance
    if (appearance === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    Appearance.setColorScheme(theme)
  }, [theme, systemAppearance])

  return (
    <SafeAreaProvider>
      <Theme className="h-screen" appearance={theme ?? systemAppearance} accentColor="gray" grayColor="slate">
        <App />
      </Theme>
    </SafeAreaProvider>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
