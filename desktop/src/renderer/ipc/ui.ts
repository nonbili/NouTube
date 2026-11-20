import { handleDeeplink } from '../lib/deeplink.js'
import { downloadProgress } from '../lib/download-progress.js'
import { UI_CHANNEL } from 'main/ipc/constants.js'
import { tabs$ } from '@/states/tabs'
import { mainClient } from '@/lib/main-client'
import { showConfirm } from '@/lib/confirm'
import { bookmarks$, newBookmark } from '@/states/bookmarks'
import { showToast } from '@/lib/toast'
import { t } from 'i18next'
import { runShortcut } from '../lib/shortcuts'
import { navigateHistory } from '@/lib/history-navigation'
import type { HistoryDirection } from '@/lib/desktop-shortcuts'
import { ui$ } from '@/states/ui'

function getWebContentsId(webview: { getWebContentsId?: () => number } | undefined): number | undefined {
  try {
    return webview?.getWebContentsId?.()
  } catch {
    // webview not attached yet
    return undefined
  }
}

const interfaces = {
  handleDeeplink,
  downloadProgress,
  openInAppTab: (url: string) => tabs$.openTab(url),
  runShortcut,
  navigateHistory: (direction: HistoryDirection, webContentsId?: number) => {
    const webview = ui$.webview.get()
    if (webContentsId !== undefined && getWebContentsId(webview) !== webContentsId) {
      // The press came from a tab that is no longer the active one.
      return
    }
    navigateHistory(webview, direction)
  },
  star: (url: string, title?: string) => {
    bookmarks$.addBookmark(newBookmark({ url, title }))
    showToast(`Saved to bookmarks`)
  },
  updateDownloaded: (version: string) => {
    showConfirm(t('update.downloadedTitle'), t('update.downloadedHint', { version }), () => {
      void mainClient.quitAndInstall()
    })
  },
}

export type UiInterface = typeof interfaces
type UiInterfaceKey = keyof UiInterface

function setupChannel(): void {
  window.electron.ipcRenderer.on(UI_CHANNEL, (e, v) => {
    const { name, args } = v
    console.log(UI_CHANNEL, name, JSON.stringify(args).slice(0, 100))
    const fn = interfaces[name as UiInterfaceKey]
    if (!fn) {
      console.error(`${fn} unimplemented`)
      return
    }
    // @ts-expect-error Dynamic IPC dispatch narrows at runtime.
    return fn(...args)
  })
}

export function initUiChannel(): void {
  setupChannel()
  void mainClient.consumePendingDeeplinks().then((links) => {
    links.forEach((link) => handleDeeplink(link.url, link.newTab))
  })
}
