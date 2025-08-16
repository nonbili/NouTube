import { UI_CHANNEL } from './constants.js'
import type { UiInterface } from '../../renderer/ipc/ui.js'
import { mainWindow } from '../lib/main-window.js'

export const uiClient = new Proxy({} as UiInterface, {
  get(_target, name) {
    return async (...args: any[]) => mainWindow.webContents.send(UI_CHANNEL, { name, args })
  },
})
