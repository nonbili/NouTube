import { toggleInterception } from 'main/lib/intercept.js'
import { openLoginWindow } from 'main/lib/login-window.js'
import { MAIN_CHANNEL } from './constants.js'
import { ipcMain, session } from 'electron'

const interfaces = {
  clearData: () => {
    session.fromPartition('persist:webview').clearData()
    session.fromPartition('').clearData({ origins: ['https://music.youtube.com', 'https://www.youtube.com'] })
  },
  fetchFeed: async (url: string) => {
    const res = await fetch(url)
    return await res.text()
  },
  toggleInterception,
  openLoginWindow,
  setCookie: async (cookie: string) => {
    const ses = session.fromPartition('persist:webview')
    const items = cookie.split(';').map((x) => x.trim())
    for (const item of items) {
      const index = item.indexOf('=')
      if (index === -1) continue
      const name = item.slice(0, index)
      const value = item.slice(index + 1)

      if (name && value) {
        const details: any = {
          url: 'https://www.youtube.com',
          name,
          value,
          path: '/',
          expirationDate: Math.floor(Date.now() / 1000) + 31536000,
        }

        if (name.startsWith('__Host-')) {
          details.secure = true
        } else {
          details.domain = '.youtube.com'
          if (name.startsWith('__Secure-')) {
            details.secure = true
          }
        }

        try {
          await ses.cookies.set(details)
        } catch (e) {
          console.error(`Failed to set cookie ${name}`, e)
        }
      }
    }
  },
}

export type MainInterface = typeof interfaces
type MainInterfaceKey = keyof MainInterface

function setupChannel() {
  ipcMain.handle(MAIN_CHANNEL, (_, name: string, ...args) => {
    console.log(MAIN_CHANNEL, name, JSON.stringify(args).slice(0, 100))
    const fn = interfaces[name as MainInterfaceKey]
    if (!fn) {
      console.error(`${fn} unimplemented`)
      return
    }
    // @ts-expect-error ??
    return fn(...args)
  })
}

export function initMainChannel() {
  setupChannel()
}
