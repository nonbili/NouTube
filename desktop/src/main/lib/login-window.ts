import { BrowserWindow } from 'electron'

export async function openLoginWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      partition: 'persist:webview',
    },
  })
  await win.loadURL('https://www.youtube.com')
  win.setTitle('After login, close this window and reload/restart NouTube')
}
