import path from 'path'
import { mainWindow } from './main-window'
import { uiClient } from 'main/ipc/ui'
import { app } from 'electron'

// https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
export function bindDeeplink() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('noutube', process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient('noutube')
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
