import { handleDeeplink } from '../lib/deeplink.js'
import { UI_CHANNEL } from 'main/ipc/constants.js'

const interfaces = {
  handleDeeplink,
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
