import { handleDeeplink } from '../lib/deeplink.js'
import { downloadProgress } from '../lib/download-progress.js'
import { UI_CHANNEL } from 'main/ipc/constants.js'
import { tabs$ } from '@/states/tabs'
import { mainClient } from '@/lib/main-client'
import { showConfirm } from '@/lib/confirm'
import { t } from 'i18next'

const interfaces = {
  handleDeeplink,
  downloadProgress,
  openInAppTab: (url: string) => tabs$.openTab(url),
  updateDownloaded: (version: string) => {
    showConfirm(t('update.downloadedTitle'), t('update.downloadedHint', { version }), () => {
      void mainClient.quitAndInstall()
    })
  },
}

export type UiInterface = typeof interfaces
type UiInterfaceKey = keyof UiInterface

function setupChannel() {
  window.electron.ipcRenderer.on(UI_CHANNEL, (e, v) => {
    const { name, args } = v
    console.log(UI_CHANNEL, name, JSON.stringify(args).slice(0, 100))
    const fn = interfaces[name as UiInterfaceKey]
    if (!fn) {
      console.error(`${fn} unimplemented`)
      return
    }
    // @ts-expect-error ??
    return fn(...args)
  })
}

export function initUiChannel() {
  setupChannel()
}
