import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { normalizeI18nLanguage, type SupportedI18nLanguage } from '@/lib/i18n'

interface Store {
  language: SupportedI18nLanguage | null
  setLanguage: (language: SupportedI18nLanguage | null) => void
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
  desktopMode: boolean
  theme: null | 'dark' | 'light'
  downloadPath: string
  lastYtDlpUpdate: number
}

const normalizeSettings = <T extends Partial<Store> | undefined>(data: T) => {
  if (!data) {
    return data
  }
  data.language = normalizeI18nLanguage(data.language)
  return data
}

export const settings$ = observable<Store>({
  language: null,
  setLanguage: (language) => {
    settings$.language.set(normalizeI18nLanguage(language))
  },
  home: 'yt',
  isYTMusic: (): boolean => settings$.home.get() === 'yt-music',

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
  desktopMode: false,
  theme: isWeb ? 'dark' : null,
  downloadPath: '',
  lastYtDlpUpdate: 0,
})

syncObservable(settings$, {
  persist: {
    name: 'settings',
    plugin: ObservablePersistMMKV,
    transform: {
      load: (data: Store) => normalizeSettings(data),
    },
  },
})
