import { ipcMain, type BrowserWindow, type WebContents } from 'electron'
import {
  createHistoryNavigationGate,
  getAppCommandHistoryDirection,
  isHistoryDirection,
  matchShortcut,
  type HistoryDirection,
} from 'noutube/lib/desktop-shortcuts'
import { EDITING_CHANNEL, NAVIGATE_CHANNEL } from 'main/ipc/constants.js'
import { uiClient } from 'main/ipc/ui.js'

// Whether a text field has focus in each webContents, reported by the preload.
const editing = new WeakMap<WebContents, boolean>()

ipcMain.on(EDITING_CHANNEL, (event, value: boolean) => {
  editing.set(event.sender, Boolean(value))
})

const historyGate = createHistoryNavigationGate()

/*
 * Navigate the active tab back/forward. `webContentsId` is the tab that saw the
 * press; the renderer ignores it when that tab is no longer the active one.
 */
function navigateHistory(direction: HistoryDirection, webContentsId?: number): void {
  if (historyGate(direction, Date.now())) {
    void uiClient.navigateHistory(direction, webContentsId)
  }
}

// Mouse Back/Forward buttons, reported by the preload of the app window or a tab's webview.
ipcMain.on(NAVIGATE_CHANNEL, (event, direction: unknown) => {
  if (isHistoryDirection(direction)) {
    navigateHistory(direction, event.sender.getType() === 'webview' ? event.sender.id : undefined)
  }
})

/*
 * Windows and Linux also report mouse side buttons and Back/Forward keys as app
 * commands, including over iframes where the preload does not run.
 */
export function watchAppCommands(window: BrowserWindow): void {
  window.on('app-command', (_event, command) => {
    const direction = getAppCommandHistoryDirection(command)
    if (direction) {
      navigateHistory(direction)
    }
  })
}

/*
 * Catch app shortcuts in `wc` (the app window or a tab's webview) on keydown,
 * before the page sees them, and run them in the renderer. Works on any page,
 * including load errors where the content script never runs.
 */
export function watchShortcuts(wc: WebContents) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return
    }
    const match = matchShortcut(input, process.platform)
    if (!match || (match.skipWhenEditing && editing.get(wc))) {
      return
    }
    event.preventDefault()
    if (!input.isAutoRepeat) {
      void uiClient.runShortcut(match.action, match.index)
    }
  })
}
