import { getMaterialColors, isDynamicColorAvailable } from '@expo/ui/jetpack-compose'
import { StyleSheet } from 'nativewind'
import { Hct, TonalPalette, argbFromHex, hexFromArgb } from '@material/material-color-utilities'
import { twColors, type DynamicPalette, type TwColor } from './tw-colors'

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

// Tailwind's dark end is near black and its light end near white, which reads
// harsh once tinted. In dark mode, move neutral tones onto Material's dark
// scheme instead: zinc-950/900/800 land on surface, surfaceContainer and
// surfaceContainerHighest, zinc-100 on onSurface, zinc-300 on onSurfaceVariant.
const darkNeutralTones: [number, number][] = [
  [0, 4],
  [2.5, 6],
  [8.4, 12],
  [15.7, 22],
  [26.9, 30],
  [47.9, 50],
  [85, 80],
  [96.2, 90],
  [100, 98],
]

const remapTone = (tone: number, anchors: [number, number][]) => {
  const i = anchors.findIndex(([from]) => from >= tone)
  if (i <= 0) {
    return anchors[Math.max(i, 0)][1]
  }
  const [x0, y0] = anchors[i - 1]
  const [x1, y1] = anchors[i]
  return y0 + ((tone - x0) * (y1 - y0)) / (x1 - x0)
}

// The palette comes back as #RRGGBBAA.
const toArgb = (rgba: string) => argbFromHex(rgba.slice(0, 7))

export const getDynamicPalette = (): DynamicPalette | null => {
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
  const light = {} as Record<TwColor, string>
  const dark = {} as Record<TwColor, string>
  for (const name of Object.keys(twColors) as TwColor[]) {
    const family = families[name.split('-')[0]]
    const palette = palettes[family]
    light[name] = hexFromArgb(palette.tone(tones[name]))
    dark[name] =
      family === 'neutral' ? hexFromArgb(palette.tone(remapTone(tones[name], darkNeutralTones))) : light[name]
  }
  return { light, dark }
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Sets the --nou-* root variables tailwind.config.js points the themed classes
// at, or restores the stock colors when palette is null.
export const applyPalette = (palette: DynamicPalette | null) => {
  const { light, dark } = palette ?? { light: twColors, dark: twColors }
  StyleSheet.registerCompiled({
    rootVariables: Object.fromEntries(
      (Object.keys(twColors) as TwColor[]).map((name) => [
        `--nou-${name}`,
        { light: channels(light[name]), dark: channels(dark[name]) },
      ]),
    ),
  } as any)
}
