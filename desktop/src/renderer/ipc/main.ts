import { MAIN_CHANNEL } from 'main/ipc/constants'
import type { MainInterface } from 'main/ipc/main'

export const mainClient = new Proxy({} as MainInterface, {
  get(_target, name) {
    return async (...args: any[]) => window.electron.ipcRenderer.invoke(MAIN_CHANNEL, name, ...args)
  },
})
