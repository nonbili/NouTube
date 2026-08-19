import { MAIN_CHANNEL } from '../desktop/src/main/ipc/constants'
import type { MainInterface } from '../desktop/src/main/ipc/main'

export type FormatOption = {
  formatId: string
  label: string
  description: string
  advanced?: boolean
  // Video-independent descriptor of what the option is, used to match a pinned format
  // against the options of the next video. Absent on the curated options, which have
  // stable format ids of their own.
  kind?: 'video' | 'audio'
  height?: number
  fps?: number
  codec?: string
}

type Asyncify<T> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Result ? (...args: Args) => Promise<Awaited<Result>> : never
}

export type MainClient = Asyncify<MainInterface>

export const mainClient = new Proxy({} as MainClient, {
  get(_target, name) {
    return async (...args: any[]) => window.electron.ipcRenderer.invoke(MAIN_CHANNEL, name, ...args)
  },
})
