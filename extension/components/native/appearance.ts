import { Appearance } from 'react-native'

/*
 * react-native-web has no `Appearance.setColorScheme`, but the app's components
 * read the scheme through it. Same patch the desktop renderer installs.
 */
const appearance = Appearance as any
const listeners = new Set<(value: { colorScheme: 'dark' | 'light' }) => void>()
let override: 'dark' | 'light' | null = null

const systemScheme = (): 'dark' | 'light' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

if (typeof appearance.setColorScheme !== 'function') {
  appearance.getColorScheme = () => override || systemScheme()
  appearance.setColorScheme = (scheme: 'dark' | 'light' | null) => {
    override = scheme
    listeners.forEach((listener) => listener({ colorScheme: appearance.getColorScheme() }))
  }

  const addChangeListener = appearance.addChangeListener
  appearance.addChangeListener = (listener: (value: { colorScheme: 'dark' | 'light' }) => void) => {
    listeners.add(listener)
    const subscription = addChangeListener ? addChangeListener(listener) : { remove: () => undefined }
    return {
      remove: () => {
        listeners.delete(listener)
        subscription.remove?.()
      },
    }
  }
}

export const getSystemColorScheme = systemScheme

export function applyColorScheme(theme: 'dark' | 'light' | null) {
  const scheme = theme || systemScheme()
  document.documentElement.classList.toggle('dark', scheme === 'dark')
  Appearance.setColorScheme(scheme)
  return scheme
}
