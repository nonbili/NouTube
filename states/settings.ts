import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'
import { isWeb } from '@/lib/utils'

interface Store {
  home: 'yt' | 'yt-music'
  isYTMusic: () => boolean

  hideShorts: boolean
  theme: null | 'dark' | 'light'
}

export const settings$ = observable<Store>({
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() == 'yt-music',

  hideShorts: true,
  theme: null,
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: isWeb ? ObservablePersistLocalStorage : ObservablePersistMMKV,
  },
})
