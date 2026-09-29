import type { TwColor } from './tw-colors'

// Wallpaper-based dynamic color (Material You) is Android 12+ only.
export const isDynamicColorAvailable = false

export const getDynamicPalette = (): Record<TwColor, string> | null => null

export const applyPalette = (palette: Record<TwColor, string> | null) => {}
