/*
 * Desktop keyboard shortcuts, shared by the main process (which catches them in
 * every webContents before the page sees them) and the renderer (which runs
 * them and lists them in the shortcuts modal). Keep this module dependency free
 * so the main process can import it.
 */

export type ShortcutAction =
  | 'newTab'
  | 'reopenClosedTab'
  | 'closeTab'
  | 'selectTab'
  | 'library'
  | 'history'
  | 'openUrl'
  | 'download'
  | 'settings'
  | 'shortcuts'

export interface ShortcutDefinition {
  action: ShortcutAction
  // Key as reported by KeyboardEvent.key / Electron Input.key, lowercased.
  keys: string[]
  shift?: boolean
  // Plain letters clash with text editing (Ctrl+B is bold), so they are left
  // to the page while a text field has focus.
  skipWhenEditing?: boolean
  // Shown in the shortcuts list, e.g. 'B' or '1-9'.
  label: string
}

export const desktopShortcuts: ShortcutDefinition[] = [
  { action: 'newTab', keys: ['t'], label: 'T' },
  { action: 'reopenClosedTab', keys: ['t'], shift: true, label: 'T' },
  { action: 'closeTab', keys: ['w'], label: 'W' },
  { action: 'selectTab', keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9'], label: '1-9' },
  { action: 'library', keys: ['b'], skipWhenEditing: true, label: 'B' },
  { action: 'history', keys: ['h'], skipWhenEditing: true, label: 'H' },
  { action: 'openUrl', keys: ['o'], skipWhenEditing: true, label: 'O' },
  { action: 'download', keys: ['d'], skipWhenEditing: true, label: 'D' },
  { action: 'settings', keys: [','], label: ',' },
  // '?' is Shift+/ on most layouts; accept the unshifted key too.
  { action: 'shortcuts', keys: ['?', '/'], label: '?' },
]

export interface ShortcutInput {
  key: string
  control?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
}

export interface ShortcutMatch {
  action: ShortcutAction
  // Zero based tab index for selectTab.
  index?: number
  skipWhenEditing: boolean
}

export function matchShortcut(input: ShortcutInput, platform: string): ShortcutMatch | null {
  const modifier = platform === 'darwin' ? input.meta : input.control
  if (!modifier || input.alt || !input.key) {
    return null
  }
  const key = input.key.toLowerCase()
  const shift = Boolean(input.shift)
  const definition = desktopShortcuts.find(
    (shortcut) =>
      shortcut.keys.includes(key) && (shortcut.action === 'shortcuts' || Boolean(shortcut.shift) === shift),
  )
  if (!definition) {
    return null
  }
  return {
    action: definition.action,
    index: definition.action === 'selectTab' ? Number(key) - 1 : undefined,
    skipWhenEditing: Boolean(definition.skipWhenEditing),
  }
}

export function formatShortcut(definition: ShortcutDefinition, platform: string) {
  const mac = platform === 'darwin'
  const parts = [mac ? '⌘' : 'Ctrl']
  if (definition.shift) {
    parts.push(mac ? '⇧' : 'Shift')
  }
  parts.push(definition.label)
  return parts.join(mac ? '' : '+')
}

export type HistoryDirection = 'back' | 'forward'

export function getMouseHistoryDirection(input: { type: string; button?: string }): HistoryDirection | null {
  // Electron reports these values at runtime even when its typings omit them.
  if (input.type === 'mouseUp' && (input.button === 'back' || input.button === 'forward')) {
    return input.button
  }
  return null
}
