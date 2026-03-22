import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

interface Store {
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean

  autoHideHeader: boolean
  feedsEnabled: boolean
  hideShorts: boolean
  hideShortsInNavbar: boolean
  hideMixPlaylist: boolean
  keepHistory: boolean
  restoreOnStart: boolean
  sponsorBlock: boolean
  userAgent: string
  theme: null | 'dark' | 'light'
}

export const settings$ = observable<Store>({
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() == 'yt-music',

  autoHideHeader: false,
  feedsEnabled: true,
  hideShorts: true,
  hideShortsInNavbar: false,
  hideMixPlaylist: false,
  keepHistory: true,
  restoreOnStart: true,
  sponsorBlock: true,
  userAgent: '',
  theme: null,
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
  },
})
