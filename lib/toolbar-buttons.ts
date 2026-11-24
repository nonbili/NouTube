import { t } from 'i18next'

// Buttons on the leading (scrolling) side of the toolbar. Built-in ones are
// shown by their own settings; menu ones mirror ⋮ menu entries and are shown
// when listed in settings.toolbarMenuButtons. Android lets the user reorder
// all of them in Settings; other platforms keep the default order.
export const builtinToolbarButtons = ['library', 'feed', 'back', 'forward', 'reload', 'home', 'history'] as const
export const menuToolbarButtons = ['switch-home', 'desktop-mode', 'open-url', 'share', 'tools', 'settings'] as const
// Playback controls come and go with what is playing, so they default to the
// end where they don't shift the other buttons. Only Android puts them on the
// leading side; other platforms keep them next to the ⋮ menu.
export const playbackToolbarButtons = ['speed', 'quality', 'sleep-timer', 'queue', 'scripts'] as const

export type BuiltinToolbarButtonId = (typeof builtinToolbarButtons)[number]
export type MenuToolbarButtonId = (typeof menuToolbarButtons)[number]
export type PlaybackToolbarButtonId = (typeof playbackToolbarButtons)[number]
export type ToolbarButtonId = BuiltinToolbarButtonId | MenuToolbarButtonId | PlaybackToolbarButtonId

export const getToolbarButtonLabel = (id: ToolbarButtonId): string =>
  ({
    library: () => t('settings.toolbarButton.library'),
    feed: () => t('settings.channelsFeed'),
    back: () => t('settings.toolbarButton.back'),
    forward: () => t('settings.toolbarButton.forward'),
    reload: () => t('menus.reload'),
    home: () => t('settings.toolbarButton.home'),
    history: () => t('modals.history'),
    'switch-home': () => t('settings.toolbarButton.switchHome'),
    'desktop-mode': () => t('menus.desktop'),
    'open-url': () => t('buttons.openUrl'),
    share: () => t('menus.share'),
    tools: () => t('menus.tools'),
    settings: () => t('settings.label'),
    speed: () => t('settings.toolbarButton.speed'),
    quality: () => t('settings.toolbarButton.quality'),
    'sleep-timer': () => t('settings.toolbarButton.sleepTimer'),
    queue: () => t('settings.toolbarButton.queue'),
    scripts: () => t('settings.toolbarButton.scripts'),
  })[id]()

export const defaultToolbarButtonOrder: ToolbarButtonId[] = [
  ...builtinToolbarButtons,
  ...menuToolbarButtons,
  ...playbackToolbarButtons,
]

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

/** Known ids once each, in the stored order, with any missing ones appended in default order. */
export const sanitizeToolbarButtonOrder = (value: unknown): ToolbarButtonId[] => {
  const known = Array.isArray(value) ? value.filter((id) => includes(defaultToolbarButtonOrder, id)) : []
  return [...new Set([...known, ...defaultToolbarButtonOrder])]
}

/**
 * `incoming` with ids it lacks (written by an older app that didn't know them)
 * put back after their neighbours in `local`, so a sync doesn't send them to the end.
 */
export const mergeToolbarButtonOrder = (incoming: unknown, local: readonly ToolbarButtonId[]): ToolbarButtonId[] => {
  const order = Array.isArray(incoming)
    ? [...new Set(incoming.filter((id): id is ToolbarButtonId => includes(defaultToolbarButtonOrder, id)))]
    : []
  local.forEach((id, index) => {
    if (!order.includes(id)) {
      const before = local.slice(0, index).findLast((other) => order.includes(other))
      order.splice(before ? order.indexOf(before) + 1 : 0, 0, id)
    }
  })
  return sanitizeToolbarButtonOrder(order)
}

export const sanitizeToolbarMenuButtons = (value: unknown): MenuToolbarButtonId[] =>
  Array.isArray(value) ? [...new Set(value.filter((id) => includes(menuToolbarButtons, id)))] : []

export const isMenuToolbarButton = (id: ToolbarButtonId): id is MenuToolbarButtonId => includes(menuToolbarButtons, id)

export const isPlaybackToolbarButton = (id: ToolbarButtonId): id is PlaybackToolbarButtonId =>
  includes(playbackToolbarButtons, id)

/** `list` with the item at `from` moved to `to` (both clamped). */
export const moveItem = <T>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list]
  if (from < 0 || from >= next.length) {
    return next
  }
  const [item] = next.splice(from, 1)
  next.splice(Math.min(Math.max(0, to), next.length), 0, item)
  return next
}
