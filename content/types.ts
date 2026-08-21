import type { ElectronAPI } from '@electron-toolkit/preload'

interface NouTubeI {
  onMessage: (payload: string) => void
  notify: (title: string, author: string, seconds: number, thumbnail: string) => void
  notifyProgress: (playing: boolean, pos: number) => void
  // Added in app 0.6.8; guard before calling so older shells keep working.
  // They take window.NouTubeToken, which only the main frame is given.
  setBrightness?: (token: string, value: number) => void
  getBrightness?: (token: string) => number
  getVolumeSteps?: (token: string) => number
  getVolumeIndex?: (token: string) => number
  setVolumeIndex?: (token: string, index: number) => void
  canAutoResume?: (token: string) => boolean
}

declare global {
  interface Window {
    _lact: number
    isAndroid: boolean
    NouTubeInitialSettings?: Record<string, unknown>
    NouTubeBlocklist?: import('../lib/blocklist').BlocklistSnapshot
    NouTubeUserStyles?: import('../lib/user-styles').UserStylesSnapshot
    NouTubeI: NouTubeI
    NouTubeToken?: string
    // Real app visibility fed by NouTubeView.onWindowVisibilityChanged; the
    // page itself always reports "visible" (see NouWebView).
    NouTubeBackground?: boolean
    NouTube: any
    trustedTypes: any
    electron: ElectronAPI
  }
}
