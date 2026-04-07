import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

interface Store {
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean

  autoHideHeader: boolean
  hideToolbarWhenScrolled: boolean
  feedsEnabled: boolean
  hideShorts: boolean
  hideShortsInNavbar: boolean
  hideMixPlaylist: boolean
  keepHistory: boolean
  playbackRate: number
  restoreOnStart: boolean
  sponsorBlock: boolean
  showPlaybackSpeedControl: boolean
  userAgent: string
  theme: null | 'dark' | 'light'
  downloadPath: string
}

export const settings$ = observable<Store>({
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() == 'yt-music',

  autoHideHeader: false,
  hideToolbarWhenScrolled: false,
  feedsEnabled: true,
  hideShorts: true,
  hideShortsInNavbar: false,
  hideMixPlaylist: false,
  keepHistory: true,
  playbackRate: 1,
  restoreOnStart: true,
  sponsorBlock: true,
  showPlaybackSpeedControl: false,
  userAgent: '',
  theme: null,
  downloadPath: '',
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
  },
})
