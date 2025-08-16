import { BrowserWindow } from 'electron'

export let mainWindow: BrowserWindow

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window
}
