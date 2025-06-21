import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'

interface Store {
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean
}

export const settings$ = observable<Store>({
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() == 'yt-music',
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
  },
})
