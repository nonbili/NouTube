import { clsx, isWeb } from '@/lib/utils'

// NativeWind evaluates `lg:` (>=1024px) against the window on native too, so a
// wide tablet matches it just like a desktop window does. The `lg:` variants
// here only make sense for the desktop vertical sidebar; leaving them unguarded
// made `lg:w-full` stretch the playback pill across the whole toolbar row on
// tablets, pushing every other button out of view. Always gate them on isWeb.

export const toolbarPillPressableClass = (web = isWeb) =>
  clsx('h-11 min-w-11 px-1 items-center justify-center shrink-0', web && 'lg:w-full lg:min-w-0 lg:px-0')

export const toolbarPillLabelClass = (web = isWeb) =>
  clsx(
    'max-w-full px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-200/80 dark:bg-zinc-700/80',
    web && 'lg:px-1.5',
  )
