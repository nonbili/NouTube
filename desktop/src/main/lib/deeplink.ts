import path from 'path'
import { mainWindow } from './main-window'
import { uiClient } from 'main/ipc/ui'
import { app } from 'electron'
import { isSupportedUrl } from '@/lib/supported-url'

const pendingDeeplinks: string[] = []

function findLaunchUrl(args: string[]): string | undefined {
  return args.find((arg) => arg.startsWith('noutube:') || isSupportedUrl(arg))
}

function handleLaunchUrl(url: string): void {
  if (mainWindow) {
    void uiClient.handleDeeplink(url)
  } else {
    pendingDeeplinks.push(url)
  }
}

export function consumePendingDeeplinks(): string[] {
  return pendingDeeplinks.splice(0)
}

// https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app
export function bindDeeplink(): void {
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

  const launchUrl = findLaunchUrl(process.argv)
  if (launchUrl) {
    pendingDeeplinks.push(launchUrl)
  }

  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    const url = findLaunchUrl(commandLine)
    if (url) {
      handleLaunchUrl(url)
    }
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleLaunchUrl(url)
  })
}
