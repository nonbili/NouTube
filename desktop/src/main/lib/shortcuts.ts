import { ipcMain, type WebContents } from 'electron'
import { getMouseHistoryDirection, matchShortcut } from 'noutube/lib/desktop-shortcuts'
import { EDITING_CHANNEL } from 'main/ipc/constants.js'
import { uiClient } from 'main/ipc/ui.js'

// Whether a text field has focus in each webContents, reported by the preload.
const editing = new WeakMap<WebContents, boolean>()

ipcMain.on(EDITING_CHANNEL, (event, value: boolean) => {
  editing.set(event.sender, Boolean(value))
})

/*
 * Catch app shortcuts in the window and each tab's webview before the page sees them.
 */
export function watchShortcuts(wc: WebContents) {
  const webContentsId = wc.getType() === 'webview' ? wc.id : undefined

  wc.on('before-mouse-event', (event, mouse) => {
    const direction = getMouseHistoryDirection(mouse)
    if (direction) {
      event.preventDefault()
      void uiClient.navigateHistory(direction, webContentsId)
    }
  })

  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return
    }
    if (input.key === 'BrowserBack' || input.key === 'BrowserForward') {
      event.preventDefault()
      if (!input.isAutoRepeat) {
        void uiClient.navigateHistory(input.key === 'BrowserBack' ? 'back' : 'forward', webContentsId)
      }
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
