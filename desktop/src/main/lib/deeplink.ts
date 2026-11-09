import path from 'path'
import { mainWindow } from './main-window'
import { uiClient } from 'main/ipc/ui'
import { app } from 'electron'
import { isSupportedUrl } from '@/lib/supported-url'

export interface Deeplink {
  url: string
  newTab?: boolean
}

const pendingDeeplinks: Deeplink[] = []

const NEW_TAB_FLAGS = ['--new-tab', '-n']

function findLaunchUrl(args: string[]): Deeplink | undefined {
  const url = args.find((arg) => arg.startsWith('noutube:') || isSupportedUrl(arg))
  if (!url) {
    return undefined
  }
  return { url, newTab: args.some((arg) => NEW_TAB_FLAGS.includes(arg)) }
}

function handleLaunchUrl(link: Deeplink): void {
  if (mainWindow) {
    void uiClient.handleDeeplink(link.url, link.newTab)
  } else {
    pendingDeeplinks.push(link)
  }
}

export function consumePendingDeeplinks(): Deeplink[] {
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

  const launchLink = findLaunchUrl(process.argv)
  if (launchLink) {
    pendingDeeplinks.push(launchLink)
  }

  app.on('second-instance', (_event, commandLine) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    const link = findLaunchUrl(commandLine)
    if (link) {
      handleLaunchUrl(link)
    }
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleLaunchUrl({ url })
  })
}
