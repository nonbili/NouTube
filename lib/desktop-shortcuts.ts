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

/*
 * Mouse side buttons, as reported by MouseEvent.button: 3 is Back, 4 is
 * Forward. Browsers navigate on them, Electron leaves it to the app.
 */
export function getMouseHistoryDirection(button: number): HistoryDirection | null {
  if (button === 3) {
    return 'back'
  }
  if (button === 4) {
    return 'forward'
  }
  return null
}

export function isHistoryDirection(value: unknown): value is HistoryDirection {
  return value === 'back' || value === 'forward'
}

/* BrowserWindow 'app-command' (Windows and Linux): mouse side buttons and Back/Forward keys. */
export function getAppCommandHistoryDirection(command: string): HistoryDirection | null {
  if (command === 'browser-backward') {
    return 'back'
  }
  if (command === 'browser-forward') {
    return 'forward'
  }
  return null
}

/*
 * One press can be reported twice, as an 'app-command' and as a DOM mouseup.
 * Returns a filter that lets a direction through at most once per `windowMs`.
 */
export function createHistoryNavigationGate(windowMs = 100): (direction: HistoryDirection, now: number) => boolean {
  let last: { direction: HistoryDirection; time: number } | null = null
  return (direction: HistoryDirection, now: number): boolean => {
    if (last && last.direction === direction && now - last.time < windowMs) {
      return false
    }
    last = { direction, time: now }
    return true
  }
}
