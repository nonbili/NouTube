import { BrowserWindow } from 'electron'
import { toggleInterception } from './intercept'

export async function openLoginWindow() {
  toggleInterception(false)
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      partition: 'persist:webview',
      webSecurity: false,
    },
  })
  await win.loadURL('https://www.youtube.com')
  win.setTitle('After login, close this window and reload/restart NouTube')
}
