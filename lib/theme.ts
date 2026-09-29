import { observable } from '@legendapp/state'
import { useValue } from '@legendapp/state/react'
import { Appearance, useColorScheme } from 'react-native'
import { twColors, type DynamicPalette, type TwColor } from './tw-colors'

// The wallpaper palette when dynamic color is on, otherwise null and the static
// Tailwind colors apply. Classes pick it up through the --nou-* CSS variables
// (see tailwind.config.js); inline colors go through twColor/useTwColor.
export const dynamicPalette$ = observable<DynamicPalette | null>(null)

const scheme = (colorScheme: string | null | undefined) => (colorScheme === 'light' ? 'light' : 'dark')

export const twColor = (name: TwColor) =>
  dynamicPalette$.peek()?.[scheme(Appearance.getColorScheme())][name] ?? twColors[name]

export const useTwColor = () => {
  const palette = useValue(dynamicPalette$)
  const colorScheme = useColorScheme()
  return (name: TwColor) => palette?.[scheme(colorScheme)][name] ?? twColors[name]
}
