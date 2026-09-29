import { observable } from '@legendapp/state'
import { useValue } from '@legendapp/state/react'
import { twColors, type TwColor } from './tw-colors'

// The wallpaper palette when dynamic color is on, otherwise null and the static
// Tailwind colors apply. Classes pick it up through the --nou-* CSS variables
// (see tailwind.config.js); inline colors go through twColor/useTwColor.
export const dynamicPalette$ = observable<Record<TwColor, string> | null>(null)

export const twColor = (name: TwColor) => dynamicPalette$.peek()?.[name] ?? twColors[name]

export const useTwColor = () => {
  const palette = useValue(dynamicPalette$)
  return (name: TwColor) => palette?.[name] ?? twColors[name]
}
