import { getMaterialColors, isDynamicColorAvailable } from '@expo/ui/jetpack-compose'
import { StyleSheet } from 'nativewind'
import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
import { twColors, type TwColor } from './tw-colors'

export { isDynamicColorAvailable }

// Material You expands the wallpaper's source color into tonal palettes: one hue
// and chroma, any tone (lightness). Tailwind's scales are tonal too, so each
// shade keeps its own tone and takes the hue and chroma of the palette its
// family plays: zinc/gray/slate are neutrals, indigo/blue the primary accent,
// sky the tertiary. Light and dark mode keep working as they do with the static
// colors, since the tones do not change.
const families: Record<string, 'neutral' | 'primary' | 'tertiary'> = {
  zinc: 'neutral',
  gray: 'neutral',
  slate: 'neutral',
  indigo: 'primary',
  blue: 'primary',
  sky: 'tertiary',
}

const tones = Object.fromEntries(
  Object.entries(twColors).map(([name, hex]) => [name, Hct.fromInt(argbFromHex(hex)).tone]),
) as Record<TwColor, number>

// The palette comes back as #RRGGBBAA.
const toArgb = (rgba: string) => argbFromHex(rgba.slice(0, 7))

export const getDynamicPalette = (): Record<TwColor, string> | null => {
  if (!isDynamicColorAvailable) {
    return null
  }
  let scheme
  try {
    scheme = getMaterialColors({ scheme: 'light' })
  } catch (e) {
    console.error(e)
    return null
  }
  const palettes = {
    neutral: TonalPalette.fromInt(toArgb(scheme.surfaceContainerHighest)),
    primary: TonalPalette.fromInt(toArgb(scheme.primary)),
    tertiary: TonalPalette.fromInt(toArgb(scheme.tertiary)),
  }
  const result = {} as Record<TwColor, string>
  for (const name of Object.keys(twColors) as TwColor[]) {
    const palette = palettes[families[name.split('-')[0]]]
    result[name] = hexFromArgb(palette.tone(tones[name]))
  }
  return result
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Sets the --nou-* root variables tailwind.config.js points the themed classes
// at, or restores the stock colors when palette is null.
export const applyPalette = (palette: Record<TwColor, string> | null) => {
  const colors = palette ?? twColors
  StyleSheet.registerCompiled({
    rootVariables: Object.fromEntries(
      Object.entries(colors).map(([name, hex]) => [`--nou-${name}`, { light: channels(hex), dark: channels(hex) }]),
    ),
  } as any)
}
