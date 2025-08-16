import path from 'path'
import { mainWindow } from './main-window'
import { uiClient } from 'main/ipc/ui'

// https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
export function bindDeeplink(app: Electron.App) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('inks', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('inks')
  }

  if (!app.requestSingleInstanceLock()) {
    app.quit()
  }

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    const url = commandLine.pop()
    if (url) {
      uiClient.handleDeeplink(url)
    }
  })

  app.on('open-url', (event, url) => {
    uiClient.handleDeeplink(url)
  })
}
