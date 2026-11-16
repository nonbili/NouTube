import { ipcMain, type WebContents } from 'electron'
import { matchShortcut } from 'noutube/lib/desktop-shortcuts'
import { EDITING_CHANNEL } from 'main/ipc/constants.js'
import { uiClient } from 'main/ipc/ui.js'

// Whether a text field has focus in each webContents, reported by the preload.
const editing = new WeakMap<WebContents, boolean>()

ipcMain.on(EDITING_CHANNEL, (event, value: boolean) => {
  editing.set(event.sender, Boolean(value))
})

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
