import type { DynamicPalette } from './tw-colors'

// Wallpaper-based dynamic color (Material You) is Android 12+ only.
export const isDynamicColorAvailable = false

export const getDynamicPalette = (): DynamicPalette | null => null

export const applyPalette = (palette: DynamicPalette | null) => {}
