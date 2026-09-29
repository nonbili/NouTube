import type { TwColor } from './tw-colors'

// Resolve with tw() from useTwColor so they follow the dynamic palette.
export const colors = {
  text: 'slate-100',
  bg: 'zinc-800',
  icon: 'slate-100',
  underlay: 'gray-600',
  iconLight: 'slate-700',
  iconLightStrong: 'slate-900',
  iconMutedLight: 'slate-600',
  iconMutedDark: 'zinc-300',
  iconSubtle: 'zinc-500',
} satisfies Record<string, TwColor>
