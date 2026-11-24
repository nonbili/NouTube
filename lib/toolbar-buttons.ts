import { t } from 'i18next'

// Buttons on the leading (scrolling) side of the toolbar. Built-in ones are
// shown by their own settings; menu ones mirror ⋮ menu entries and are shown
// when listed in settings.toolbarMenuButtons. Android lets the user reorder
// all of them in Settings; other platforms keep the default order.
export const builtinToolbarButtons = ['library', 'feed', 'back', 'forward', 'reload', 'home', 'history'] as const
export const menuToolbarButtons = ['switch-home', 'desktop-mode', 'open-url', 'share', 'tools', 'settings'] as const

export type BuiltinToolbarButtonId = (typeof builtinToolbarButtons)[number]
export type MenuToolbarButtonId = (typeof menuToolbarButtons)[number]
export type ToolbarButtonId = BuiltinToolbarButtonId | MenuToolbarButtonId

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
  })[id]()

export const defaultToolbarButtonOrder: ToolbarButtonId[] = [...builtinToolbarButtons, ...menuToolbarButtons]

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value)

/** Known ids once each, in the stored order, with any missing ones appended in default order. */
export const sanitizeToolbarButtonOrder = (value: unknown): ToolbarButtonId[] => {
  const known = Array.isArray(value) ? value.filter((id) => includes(defaultToolbarButtonOrder, id)) : []
  return [...new Set([...known, ...defaultToolbarButtonOrder])]
}

export const sanitizeToolbarMenuButtons = (value: unknown): MenuToolbarButtonId[] =>
  Array.isArray(value) ? [...new Set(value.filter((id) => includes(menuToolbarButtons, id)))] : []

export const isMenuToolbarButton = (id: ToolbarButtonId): id is MenuToolbarButtonId => includes(menuToolbarButtons, id)

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
