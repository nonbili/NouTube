import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

interface Store {
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean

  hideShorts: boolean
  keepHistory: boolean
  theme: null | 'dark' | 'light'
}

export const settings$ = observable<Store>({
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() == 'yt-music',

  hideShorts: true,
  keepHistory: true,
  theme: null,
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
  },
})
