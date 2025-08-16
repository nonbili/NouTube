import type { ElectronAPI } from '@electron-toolkit/preload'

interface NouTubeI {
  onMessage: (payload: string) => void
  notify: (title: string, author: string, seconds: number, thumbnail: string) => void
  notifyProgress: (playing: boolean, pos: number) => void
}

declare global {
  interface Window {
    _lact: number
    NouTubeI: NouTubeI
    NouTube: any
    trustedTypes: any
    electron: ElectronAPI
  }
}
